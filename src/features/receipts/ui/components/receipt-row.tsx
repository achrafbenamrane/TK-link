import { Feather } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { AppText } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { CATEGORY_LABEL, formatMoney } from '../../lib/receipts';
import type { Receipt } from '../../model/schema';

/** Date courte : « 12 mars ». L'année n'apparaît que hors de l'année en cours. */
function shortDate(ms: number): string {
  const d = new Date(ms);
  const months = [
    'janv.',
    'févr.',
    'mars',
    'avr.',
    'mai',
    'juin',
    'juil.',
    'août',
    'sept.',
    'oct.',
    'nov.',
    'déc.',
  ];
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return `${d.getDate()} ${months[d.getMonth()]}${sameYear ? '' : ` ${d.getFullYear()}`}`;
}

/** Une ligne du portefeuille — l'unité de lecture de l'historique. */
export function ReceiptRow({ receipt, onPress }: { receipt: Receipt; onPress: () => void }) {
  const isInvoice = receipt.kind === 'facture';

  return (
    <Pressable
      testID={`receipt-row-${receipt.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${receipt.merchant}, ${formatMoney(receipt.totalCents, receipt.currency)}`}
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-card bg-surface p-3.5 active:opacity-70"
      style={{ borderWidth: 1, borderColor: colors.line }}
    >
      {/* Pastille catégorie */}
      <View className="h-11 w-11 items-center justify-center rounded-control bg-brand-50">
        <Feather
          name={receipt.channel === 'online' ? 'globe' : 'shopping-bag'}
          size={19}
          color={colors.brand600}
        />
      </View>

      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-1.5">
          <AppText className="flex-1 font-sans-semibold text-ink" numberOfLines={1}>
            {receipt.merchant}
          </AppText>
          {receipt.pinned ? <Feather name="bookmark" size={13} color={colors.brand500} /> : null}
        </View>
        <AppText variant="caption" numberOfLines={1}>
          {CATEGORY_LABEL[receipt.category]} · {shortDate(receipt.issuedAt)}
        </AppText>
      </View>

      <View className="items-end gap-1">
        <AppText className="font-sans-bold text-ink" style={{ fontVariant: ['tabular-nums'] }}>
          {formatMoney(receipt.totalCents, receipt.currency)}
        </AppText>
        {isInvoice ? (
          <View className="rounded-pill bg-brand-50 px-2 py-0.5">
            <AppText className="font-sans-semibold text-brand-700" style={{ fontSize: 10 }}>
              FACTURE
            </AppText>
          </View>
        ) : (
          <AppText variant="caption" className="text-ink-faint" style={{ fontSize: 11 }}>
            +{receipt.pointsEarned} pts
          </AppText>
        )}
      </View>
    </Pressable>
  );
}
