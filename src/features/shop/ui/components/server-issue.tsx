import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

import { type IssueRoute, ROUTE_HINT, ROUTE_LABEL, SERVER_REPORTABLE } from '../../lib/issues';
import { ISSUE_ERROR, type IssueError, reportServerIssue } from '../../lib/issues-api';
import type { ServerOrder } from '../../lib/orders-api';
import { IssueForm, ReportIssueButton } from './order-feedback';

/**
 * SIGNALER UN PROBLÈME SUR UNE COMMANDE DU SERVEUR (migration 0027) — le point d'entrée unique du
 * CDC V1.1, sous le suivi de la commande :
 *
 * - payée, pas close : les trois motifs ; le serveur décide — remboursement sans examen (« je n'ai
 *   rien reçu » avant la remise) ou la file du back-office ;
 * - déjà entre les mains de TK LINK (remboursement en cours, litige) : où en est la commande, et de
 *   quoi écrire au support ;
 * - à payer, annulée, remboursée : pas de signalement, le support reste joignable.
 *
 * Serveur sans 0027 : on retombe sur l'ancien chemin, une demande au support rattachée à la commande.
 */
export function ServerReportIssue({
  order,
  onChanged,
}: {
  order: ServerOrder;
  /** Relire la commande (son statut vient de changer). */
  onChanged: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<IssueError | null>(null);
  const [sent, setSent] = useState<IssueRoute | null>(null);

  const writeToSupport = () =>
    router.push({ pathname: '/aide/nouvelle', params: { commande: order.id, sujet: 'commande' } });

  const route: IssueRoute | null =
    sent ??
    (order.status === 'remboursement_en_cours'
      ? 'remboursement'
      : order.status === 'litige'
        ? 'admin'
        : null);
  if (route) return <IssueSent route={route} onWrite={writeToSupport} />;

  if (!SERVER_REPORTABLE.includes(order.status)) return <SupportLink onPress={writeToSupport} />;

  if (!open) return <ReportIssueButton onPress={() => setOpen(true)} />;

  return (
    <IssueForm
      busy={busy}
      error={error ? ISSUE_ERROR[error] : null}
      onCancel={() => {
        setOpen(false);
        setError(null);
      }}
      onSubmit={async (kind) => {
        if (busy) return;
        setBusy(true);
        setError(null);
        const res = await reportServerIssue(order.id, kind);
        setBusy(false);
        if (res.ok) {
          setSent(res.value);
          onChanged();
          return;
        }
        if (res.code === 'unavailable') {
          setOpen(false);
          writeToSupport();
          return;
        }
        setError(res.code);
      }}
    />
  );
}

/** Le signalement est parti : où il en est, et de quoi ajouter un message. */
function IssueSent({ route, onWrite }: { route: IssueRoute; onWrite: () => void }) {
  const colors = useColors();
  return (
    <View
      testID="server-issue-sent"
      className="mb-4 gap-3 rounded-card border border-line bg-surface-muted p-4"
    >
      <View className="flex-row items-center gap-3">
        <Feather
          name={route === 'remboursement' ? 'rotate-ccw' : 'alert-circle'}
          size={18}
          color={colors.brand600}
        />
        <View className="flex-1">
          <AppText className="font-sans-bold text-sm text-ink">{ROUTE_LABEL[route]}</AppText>
          <AppText variant="caption" className="text-ink-faint">
            {ROUTE_HINT[route]}
          </AppText>
        </View>
      </View>
      <Pressable
        testID="server-issue-write"
        accessibilityRole="button"
        accessibilityLabel="Écrire au support TK LINK à propos de cette commande"
        onPress={onWrite}
        hitSlop={6}
        className="self-start active:opacity-70"
      >
        <AppText className="font-sans-semibold text-brand-600" style={{ fontSize: 14 }}>
          Écrire au support
        </AppText>
      </Pressable>
    </View>
  );
}

/** Pas de signalement possible ici : le support, rattaché à la commande. */
function SupportLink({ onPress }: { onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      testID="server-order-report"
      accessibilityRole="button"
      accessibilityLabel="Écrire au support TK LINK à propos de cette commande"
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-card border border-line bg-surface p-4 active:opacity-70"
    >
      <Feather name="message-circle" size={18} color={colors.ink} />
      <AppText className="flex-1 font-sans-semibold text-ink">Écrire au support</AppText>
      <Feather name="chevron-right" size={16} color={colors.inkFaint} />
    </Pressable>
  );
}
