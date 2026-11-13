import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText, Screen, TextField } from '@/shared/ui';
import { BackButton } from '@/shared/ui/back-button';
import { useColors } from '@/shared/theme/theme-provider';

import { formatWhen } from '../lib/format';
import { fetchThread, sendMessage, type SupportError, watchThread } from '../lib/support-api';
import {
  BODY_MAX,
  CATEGORY_LABEL,
  STATUS_LABEL,
  type SupportMessage,
  type Ticket,
} from '../model/schema';

const ERROR: Record<SupportError, string> = {
  not_configured: 'Le support est disponible avec un compte relié au serveur TK LINK.',
  unavailable: 'Le support n’est pas encore activé par TK LINK. Réessayez bientôt.',
  not_signed_in: 'Connectez-vous pour lire cette demande.',
  too_many_tickets: '',
  ticket_closed: 'Cette demande est fermée. Ouvrez-en une nouvelle si besoin.',
  invalid: 'Ce message ne peut pas être envoyé.',
  network: 'Pas de connexion. Votre message n’est pas parti : réessayez.',
  unknown: 'Une erreur est survenue. Réessayez dans un instant.',
};

/** Ajoute des messages sans doublon (l’écoute en direct renvoie aussi les siens), dans l’ordre. */
export function mergeMessages(list: SupportMessage[], more: SupportMessage[]): SupportMessage[] {
  const byId = new Map(list.map((m) => [m.id, m]));
  for (const m of more) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.at - b.at);
}

/** UNE DEMANDE — la conversation avec l’équipe TK LINK, et la réponse en bas. */
export function TicketScreen({ ticketId }: { ticketId: string }) {
  const colors = useColors();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [error, setError] = useState<SupportError | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const scroller = useRef<ScrollView>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchThread(ticketId).then((res) => {
        if (!alive) return;
        setNow(Date.now());
        if (res.ok) {
          setTicket(res.value.ticket);
          setMessages((list) => mergeMessages(list, res.value.messages));
          setError(null);
        } else setError(res.code);
      });
    void load();
    // Une réponse de TK LINK arrive en direct ; on relit aussi la demande (son statut a changé).
    const stop = watchThread(ticketId, (m) => {
      setMessages((list) => mergeMessages(list, [m]));
      if (m.fromStaff) void load();
    });
    return () => {
      alive = false;
      stop();
    };
  }, [ticketId]);

  const count = messages.length;
  useEffect(() => {
    scroller.current?.scrollToEnd({ animated: true });
  }, [count]);

  const closed = ticket?.status === 'ferme';
  const canSend = draft.trim().length > 0 && !sending && !closed;

  const submit = async () => {
    if (!canSend) return;
    setSending(true);
    const res = await sendMessage(ticketId, draft);
    setSending(false);
    if (!res.ok) {
      setError(res.code);
      return;
    }
    setDraft('');
    setError(null);
    const fresh = await fetchThread(ticketId);
    if (fresh.ok) {
      setTicket(fresh.value.ticket);
      setMessages((list) => mergeMessages(list, fresh.value.messages));
      setNow(Date.now());
    }
  };

  return (
    <Screen testID="support-ticket-screen" padded={false}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="gap-1 px-5 pb-3 pt-2">
          <BackButton fallbackHref="/aide" />
          <AppText variant="title" numberOfLines={2}>
            {ticket?.subject ?? 'Demande'}
          </AppText>
          {ticket ? (
            <AppText testID="support-ticket-status" variant="caption" className="text-ink-faint">
              {CATEGORY_LABEL[ticket.category]} · {STATUS_LABEL[ticket.status]}
            </AppText>
          ) : null}
        </View>

        <ScrollView
          ref={scroller}
          className="flex-1"
          contentContainerClassName="gap-3 px-5 pb-4"
          keyboardShouldPersistTaps="handled"
        >
          {!ticket && !error ? <ActivityIndicator color={colors.brand500} /> : null}
          {messages.map((m) => (
            <View
              key={m.id}
              testID={`support-message-${m.id}`}
              className={cn('max-w-[85%] gap-1', m.fromStaff ? 'self-start' : 'self-end')}
            >
              <AppText
                variant="caption"
                className={cn('text-ink-faint', m.fromStaff ? 'self-start' : 'self-end')}
                style={{ fontSize: 11 }}
              >
                {m.fromStaff ? 'Équipe TK LINK' : 'Vous'} · {formatWhen(m.at, now)}
              </AppText>
              <View
                className={cn(
                  'rounded-card px-3.5 py-2.5',
                  m.fromStaff ? 'border border-line bg-surface' : 'bg-brand-500',
                )}
              >
                <AppText
                  className={m.fromStaff ? 'text-ink' : 'text-white'}
                  style={{ fontSize: 14 }}
                >
                  {m.body}
                </AppText>
              </View>
            </View>
          ))}
          {ticket && messages.length > 0 && !messages.some((m) => m.fromStaff) ? (
            <AppText testID="support-waiting" variant="caption" className="text-center">
              Bien reçu. L’équipe TK LINK vous répond ici, et vous prévient d’une notification.
            </AppText>
          ) : null}
        </ScrollView>

        {error ? (
          <AppText
            testID="support-ticket-error"
            variant="caption"
            className="px-5 pb-2 text-danger"
          >
            {ERROR[error]}
          </AppText>
        ) : null}

        {closed ? (
          <AppText testID="support-closed" variant="caption" className="px-5 pb-6 text-center">
            Cette demande est fermée. Pour autre chose, ouvrez une nouvelle demande.
          </AppText>
        ) : (
          <View className="flex-row items-end gap-2 border-t border-line px-5 pb-6 pt-3">
            <View className="flex-1">
              <TextField
                testID="support-reply"
                value={draft}
                onChangeText={(v) => setDraft(v.slice(0, BODY_MAX))}
                placeholder="Votre message"
                accessibilityLabel="Votre message"
                multiline
                compact
              />
            </View>
            <Pressable
              testID="support-reply-send"
              accessibilityRole="button"
              accessibilityLabel="Envoyer"
              accessibilityState={{ disabled: !canSend }}
              disabled={!canSend}
              onPress={() => void submit()}
              className={cn(
                'h-10 w-10 items-center justify-center rounded-pill',
                canSend ? 'bg-brand-500 active:bg-brand-600' : 'bg-surface-muted',
              )}
            >
              {sending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Feather name="send" size={17} color={canSend ? '#FFFFFF' : colors.inkFaint} />
              )}
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}
