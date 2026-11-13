import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText, Button, Screen } from '@/shared/ui';
import { BackButton } from '@/shared/ui/back-button';
import { useColors } from '@/shared/theme/theme-provider';

import { formatWhen } from '../lib/format';
import { fetchTickets, type SupportError } from '../lib/support-api';
import { CATEGORY_LABEL, STATUS_LABEL, type Ticket, type TicketStatus } from '../model/schema';

const STATUS_TONE: Record<TicketStatus, string> = {
  ouvert: 'border-line text-ink-muted',
  en_cours: 'border-brand-500 text-brand-600',
  resolu: 'border-success text-success',
  ferme: 'border-line text-ink-faint',
};

const LOAD_ERROR: Record<SupportError, string> = {
  not_configured: 'Le support est disponible avec un compte relié au serveur TK LINK.',
  unavailable: 'Le support n’est pas encore activé par TK LINK. Réessayez bientôt.',
  not_signed_in: 'Connectez-vous pour écrire au support.',
  too_many_tickets: '',
  ticket_closed: '',
  invalid: '',
  network: 'Pas de connexion : vos demandes s’afficheront dès votre retour en ligne.',
  unknown: 'Vos demandes n’ont pas pu être chargées. Réessayez dans un instant.',
};

type Props = {
  onOpenTicket: (id: string) => void;
  onNewTicket: () => void;
};

/**
 * AIDE ET SUPPORT — rapport d’avancement du 13/11/2026 : « messagerie interne, réception dans
 * l’interface d’administration, système de tickets ». Chaque demande est un ticket que l’équipe
 * TK LINK suit et auquel elle répond depuis le back-office ; la réponse arrive ici.
 */
export function SupportScreen({ onOpenTicket, onNewTicket }: Props) {
  const colors = useColors();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [error, setError] = useState<SupportError | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  // Relue à chaque retour sur l'écran : une réponse a pu arriver pendant qu'on était ailleurs.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void fetchTickets().then((res) => {
        if (!alive) return;
        setLoading(false);
        setNow(Date.now());
        if (res.ok) {
          setTickets(res.value);
          setError(null);
        } else setError(res.code);
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  return (
    <Screen testID="support-screen" padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-4 px-5 pb-10">
        <View className="gap-1 pt-2">
          <BackButton fallbackHref="/profil" />
          <AppText variant="display" className="text-2xl">
            Aide et support
          </AppText>
          <AppText variant="caption">
            Écrivez à l’équipe TK LINK : une commande, un paiement, votre compte… Nous vous
            répondons ici.
          </AppText>
        </View>

        {error === 'not_configured' ||
        error === 'unavailable' ||
        error === 'not_signed_in' ? null : (
          <Button testID="support-new" label="Nouvelle demande" onPress={onNewTicket} />
        )}

        {error ? (
          <AppText testID="support-error" variant="caption" className="text-ink-muted">
            {LOAD_ERROR[error]}
          </AppText>
        ) : null}

        {loading ? <ActivityIndicator color={colors.brand500} /> : null}

        {!loading && !error && tickets.length === 0 ? (
          <View testID="support-empty" className="items-center gap-2 py-8">
            <Feather name="message-circle" size={28} color={colors.inkFaint} />
            <AppText variant="caption" className="text-center">
              Aucune demande pour l’instant. Une question ? Écrivez-nous.
            </AppText>
          </View>
        ) : null}

        {tickets.length > 0 ? (
          <View className="rounded-card border border-line bg-surface">
            {tickets.map((t, i) => (
              <Pressable
                key={t.id}
                testID={`support-ticket-${t.id}`}
                accessibilityRole="button"
                accessibilityLabel={`${t.subject}, ${STATUS_LABEL[t.status]}`}
                onPress={() => onOpenTicket(t.id)}
                className={cn(
                  'flex-row items-center gap-3 px-4 py-3.5 active:opacity-70',
                  i < tickets.length - 1 && 'border-b border-line',
                )}
              >
                <View className="flex-1 gap-0.5">
                  <AppText variant="label" numberOfLines={1}>
                    {t.subject}
                  </AppText>
                  <AppText variant="caption" className="text-ink-faint">
                    {CATEGORY_LABEL[t.category]} · {formatWhen(t.lastMessageAt, now)}
                  </AppText>
                </View>
                <View className={cn('rounded-pill border px-2.5 py-1', STATUS_TONE[t.status])}>
                  <AppText
                    className={cn('font-sans-semibold', STATUS_TONE[t.status])}
                    style={{ fontSize: 11 }}
                  >
                    {STATUS_LABEL[t.status]}
                  </AppText>
                </View>
                <Feather name="chevron-right" size={16} color={colors.inkFaint} />
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
