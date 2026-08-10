import { Feather } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { AppText, Button, Screen } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { CATEGORY_LABEL, formatMoney } from '../lib/receipts';
import { formatKeptUntil } from '../lib/retention';
import { selectReceipts, useReceiptsStore } from '../model/store';

type Props = {
  id: string;
  onBack: () => void;
};

function longDate(ms: number): string {
  const d = new Date(ms);
  const months = [
    'janvier',
    'février',
    'mars',
    'avril',
    'mai',
    'juin',
    'juillet',
    'août',
    'septembre',
    'octobre',
    'novembre',
    'décembre',
  ];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} à ${hh} h ${mm}`;
}

/**
 * Le ticket en détail — et sa conversion en facture certifiée.
 *
 * L'écran montre exactement les champs que la comptabilité attend (ceux que
 * l'IA extrait) : organisation, référence, date, devise, TTC / TVA / HT,
 * échéance. C'est ce qui rend le document utilisable, pas seulement lisible.
 */
export function ReceiptDetailScreen({ id, onBack }: Props) {
  const receipts = useReceiptsStore(selectReceipts);
  const convertToInvoice = useReceiptsStore((s) => s.convertToInvoice);
  const togglePinned = useReceiptsStore((s) => s.togglePinned);

  const receipt = useMemo(() => receipts.find((r) => r.id === id), [receipts, id]);

  if (!receipt) {
    return (
      <Screen testID="receipt-detail-missing">
        <View className="flex-1 items-center justify-center gap-3">
          <Feather name="file-minus" size={30} color={colors.inkFaint} />
          <AppText variant="title" className="text-base">
            Ticket introuvable
          </AppText>
          <Button testID="receipt-back" label="Retour" onPress={onBack} />
        </View>
      </Screen>
    );
  }

  const isInvoice = receipt.kind === 'facture';

  return (
    <Screen testID="receipt-detail-screen" padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-5 pb-10">
        {/* Bandeau */}
        <View className="flex-row items-center justify-between py-2">
          <Pressable
            testID="receipt-back"
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={10}
            onPress={onBack}
            className="h-9 w-9 items-center justify-center rounded-pill bg-surface-muted"
          >
            <Feather name="chevron-left" size={22} color={colors.ink} />
          </Pressable>
          <Pressable
            testID="receipt-pin"
            accessibilityRole="button"
            accessibilityLabel={receipt.pinned ? 'Retirer des épinglés' : 'Épingler ce ticket'}
            hitSlop={10}
            onPress={() => togglePinned(receipt.id)}
            className="h-9 w-9 items-center justify-center rounded-pill bg-surface-muted"
          >
            <Feather
              name="bookmark"
              size={18}
              color={receipt.pinned ? colors.brand500 : colors.inkMuted}
            />
          </Pressable>
        </View>

        {/* Le document */}
        <View
          className="mt-1 overflow-hidden rounded-card bg-surface"
          style={{ borderWidth: 1, borderColor: colors.line }}
        >
          {/* Tête */}
          <View className="items-center gap-1 bg-surface-inverse px-5 py-6">
            <AppText variant="caption" className="text-ink-inverse/60">
              {isInvoice ? 'Facture certifiée' : 'Ticket de caisse'}
            </AppText>
            <AppText className="text-center font-display text-ink-inverse" style={{ fontSize: 19 }}>
              {receipt.merchant}
            </AppText>
            <AppText
              className="mt-1 font-display text-lime"
              style={{ fontSize: 30, fontVariant: ['tabular-nums'] }}
            >
              {formatMoney(receipt.totalCents, receipt.currency)}
            </AppText>
            <AppText variant="caption" className="text-ink-inverse/60">
              {longDate(receipt.issuedAt)}
            </AppText>
          </View>

          {/* Lignes d'achat */}
          {receipt.lines.length > 0 ? (
            <View className="gap-2.5 px-5 py-4">
              {receipt.lines.map((l, i) => (
                <View key={`${l.label}-${i}`} className="flex-row items-baseline gap-3">
                  <AppText className="text-ink-faint" style={{ fontSize: 13, width: 26 }}>
                    ×{l.qty}
                  </AppText>
                  <AppText className="flex-1 text-ink" style={{ fontSize: 14 }} numberOfLines={2}>
                    {l.label}
                  </AppText>
                  <AppText
                    className="font-sans-semibold text-ink"
                    style={{ fontSize: 14, fontVariant: ['tabular-nums'] }}
                  >
                    {formatMoney(l.unitCents * l.qty, receipt.currency)}
                  </AppText>
                </View>
              ))}
            </View>
          ) : null}

          {/* Montants — ce que la compta reprend */}
          <View className="gap-2 border-t px-5 py-4" style={{ borderTopColor: colors.line }}>
            <Row label="Montant HT" value={formatMoney(receipt.netCents, receipt.currency)} />
            <Row label="Montant TVA" value={formatMoney(receipt.vatCents, receipt.currency)} />
            <Row
              label="Montant TTC"
              value={formatMoney(receipt.totalCents, receipt.currency)}
              strong
            />
          </View>

          {/* Identité du document */}
          <View
            className="gap-2 border-t bg-surface-muted px-5 py-4"
            style={{ borderTopColor: colors.line }}
          >
            <Row label="Référence" value={receipt.reference} mono />
            <Row label="Devise" value={receipt.currency} />
            <Row label="Catégorie" value={CATEGORY_LABEL[receipt.category]} />
            <Row
              label="Canal"
              value={receipt.channel === 'online' ? 'Achat en ligne' : 'En magasin'}
            />
            {receipt.dueAt ? (
              <Row label="Échéance" value={new Date(receipt.dueAt).toLocaleDateString('fr-FR')} />
            ) : null}
            {receipt.supplierCode ? (
              <Row label="Code fournisseur" value={receipt.supplierCode} mono />
            ) : null}
            {/* CDC §16 — on dit jusqu'à quand le document est gardé, plutôt
                que de le faire disparaître un matin sans prévenir. */}
            <Row
              label={receipt.pinned ? 'Conservation' : 'Conservé jusqu’au'}
              value={receipt.pinned ? 'Sans limite (épinglé)' : formatKeptUntil(receipt)}
            />
          </View>
        </View>

        {/* Certificat / conversion */}
        {isInvoice ? (
          <View
            testID="receipt-certificate"
            className="mt-4 flex-row items-center gap-3 rounded-card bg-brand-50 p-4"
          >
            <Feather name="award" size={22} color={colors.brand600} />
            <View className="flex-1">
              <AppText className="font-sans-semibold text-brand-700" style={{ fontSize: 14 }}>
                Certificat de facture unique
              </AppText>
              <AppText
                variant="caption"
                className="text-brand-700/80"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {receipt.certificateId} · envoyée au commerçant et à son comptable
              </AppText>
            </View>
          </View>
        ) : (
          <View className="mt-4 gap-2">
            <Button
              testID="receipt-convert"
              label="Transformer en facture"
              onPress={() => convertToInvoice(receipt.id)}
            />
            <AppText variant="caption" className="text-center text-ink-faint">
              La facture reçoit un certificat unique et part à votre comptable.
            </AppText>
          </View>
        )}

        {/* Points gagnés */}
        <View className="mt-4 flex-row items-center justify-center gap-2">
          <Feather name="gift" size={15} color={colors.brand600} />
          <AppText variant="caption" className="text-ink-muted">
            Cet achat vous a rapporté{' '}
            <AppText className="font-sans-bold text-ink">{receipt.pointsEarned} points</AppText>.
          </AppText>
        </View>
      </ScrollView>
    </Screen>
  );
}

function Row({
  label,
  value,
  strong,
  mono,
}: {
  label: string;
  value: string;
  strong?: boolean;
  mono?: boolean;
}) {
  return (
    <View className="flex-row items-baseline justify-between gap-3">
      <AppText variant="caption" className="text-ink-muted">
        {label}
      </AppText>
      <AppText
        className={strong ? 'font-sans-bold text-ink' : 'font-sans-medium text-ink'}
        style={{ fontSize: strong ? 15 : 14, fontVariant: mono ? ['tabular-nums'] : undefined }}
      >
        {value}
      </AppText>
    </View>
  );
}
