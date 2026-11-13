import { useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText, Button, Screen, TextField } from '@/shared/ui';
import { BackButton } from '@/shared/ui/back-button';

import { openTicket, type SupportError } from '../lib/support-api';
import {
  BODY_MAX,
  CATEGORY_LABEL,
  NewTicketSchema,
  SUBJECT_MAX,
  TICKET_CATEGORIES,
  type TicketCategory,
} from '../model/schema';

const SEND_ERROR: Record<SupportError, string> = {
  not_configured: 'Le support est disponible avec un compte relié au serveur TK LINK.',
  unavailable: 'Le support n’est pas encore activé par TK LINK. Réessayez bientôt.',
  not_signed_in: 'Connectez-vous pour écrire au support.',
  too_many_tickets:
    'Vous avez ouvert cinq demandes aujourd’hui. Écrivez dans l’une d’elles, nous y répondons.',
  ticket_closed: 'Cette demande est fermée.',
  invalid: 'Vérifiez le sujet et le message.',
  network: 'Pas de connexion. Votre message n’est pas parti : réessayez.',
  unknown: 'Votre demande n’a pas pu être envoyée. Réessayez dans un instant.',
};

type Props = {
  /** Commande concernée (depuis « Signaler un problème » d’une commande du serveur). */
  orderId?: string | null;
  /** Catégorie proposée d’office. */
  initialCategory?: TicketCategory;
  onCreated: (ticketId: string) => void;
};

/** NOUVELLE DEMANDE AU SUPPORT — le sujet, ce qui ne va pas, et c’est parti. */
export function NewTicketScreen({ orderId = null, initialCategory, onCreated }: Props) {
  const [category, setCategory] = useState<TicketCategory>(
    initialCategory ?? (orderId ? 'commande' : 'autre'),
  );
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [errors, setErrors] = useState<Partial<Record<'subject' | 'body', string>>>({});
  const [failure, setFailure] = useState<SupportError | null>(null);
  const [sending, setSending] = useState(false);
  const busy = useRef(false);

  const submit = async () => {
    if (busy.current) return;
    const parsed = NewTicketSchema.safeParse({ category, subject, body, orderId });
    if (!parsed.success) {
      const found: Partial<Record<'subject' | 'body', string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if ((key === 'subject' || key === 'body') && !found[key]) found[key] = issue.message;
      }
      setErrors(found);
      return;
    }
    setErrors({});
    setFailure(null);
    busy.current = true;
    setSending(true);
    const res = await openTicket(parsed.data);
    busy.current = false;
    setSending(false);
    if (res.ok) onCreated(res.value);
    else setFailure(res.code);
  };

  return (
    <Screen testID="support-new-screen" padded={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="gap-4 px-5 pb-10"
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-1 pt-2">
          <BackButton fallbackHref="/aide" />
          <AppText variant="display" className="text-2xl">
            Nouvelle demande
          </AppText>
          <AppText variant="caption">
            L’équipe TK LINK vous répond dans l’application, et vous prévient d’une notification.
          </AppText>
        </View>

        <View className="gap-2">
          <AppText variant="label">C’est à propos de…</AppText>
          <View className="flex-row flex-wrap gap-2">
            {TICKET_CATEGORIES.map((c) => {
              const on = c === category;
              return (
                <Pressable
                  key={c}
                  testID={`support-category-${c}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={CATEGORY_LABEL[c]}
                  onPress={() => setCategory(c)}
                  className={cn(
                    'rounded-pill border px-3.5 py-2',
                    on ? 'border-brand-500 bg-brand-500' : 'border-line bg-surface',
                  )}
                >
                  <AppText
                    className={cn('font-sans-semibold', on ? 'text-white' : 'text-ink-muted')}
                    style={{ fontSize: 13 }}
                  >
                    {CATEGORY_LABEL[c]}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View className="gap-1.5">
          <AppText variant="label">Sujet</AppText>
          <TextField
            testID="support-subject"
            value={subject}
            onChangeText={(v) => setSubject(v.slice(0, SUBJECT_MAX))}
            placeholder="Ex. Il manquait un article dans ma commande"
            accessibilityLabel="Sujet de la demande"
            invalid={Boolean(errors.subject)}
          />
          {errors.subject ? (
            <AppText testID="support-subject-error" variant="caption" className="text-danger">
              {errors.subject}
            </AppText>
          ) : null}
        </View>

        <View className="gap-1.5">
          <AppText variant="label">Votre message</AppText>
          <TextField
            testID="support-body"
            value={body}
            onChangeText={(v) => setBody(v.slice(0, BODY_MAX))}
            placeholder="Racontez-nous ce qui s’est passé : la date, le commerce, le montant…"
            accessibilityLabel="Message"
            multiline
            numberOfLines={6}
            invalid={Boolean(errors.body)}
            className="min-h-[140px]"
            style={{ textAlignVertical: 'top' }}
          />
          {errors.body ? (
            <AppText testID="support-body-error" variant="caption" className="text-danger">
              {errors.body}
            </AppText>
          ) : null}
        </View>

        {failure ? (
          <AppText testID="support-send-error" variant="caption" className="text-danger">
            {SEND_ERROR[failure]}
          </AppText>
        ) : null}

        <Button
          testID="support-send"
          label="Envoyer à TK LINK"
          loading={sending}
          disabled={sending}
          onPress={() => void submit()}
        />
      </ScrollView>
    </Screen>
  );
}
