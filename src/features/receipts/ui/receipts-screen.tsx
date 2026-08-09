import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { AppText, Screen } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import {
  ecoImpact,
  formatGrams,
  formatLiters,
  formatMoney,
  groupByMonth,
  searchReceipts,
} from '../lib/receipts';
import { selectReceipts, useReceiptsStore } from '../model/store';
import { ReceiptRow } from './components/receipt-row';

type Props = {
  /** Ouvre le détail d'un ticket (la route décide de la navigation). */
  onOpenReceipt: (id: string) => void;
};

/** Bornes du mois en cours — pour le total affiché en tête. */
function currentMonthRange(now = Date.now()): [number, number] {
  const d = new Date(now);
  return [
    new Date(d.getFullYear(), d.getMonth(), 1).getTime(),
    new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime(),
  ];
}

/**
 * Le portefeuille de tickets — l'écran d'accueil de TK LINK.
 *
 * On y répond à trois questions, dans cet ordre : combien j'ai dépensé ce
 * mois-ci, qu'est-ce que j'ai évité en papier, et où est le ticket que je
 * cherche.
 */
export function ReceiptsScreen({ onOpenReceipt }: Props) {
  // Tranche brute + dérivation en useMemo : un sélecteur filtrant ferait boucler
  // Zustand v5 (voir docs/quality/quality-score.md).
  const receipts = useReceiptsStore(selectReceipts);
  const [query, setQuery] = useState('');

  const [monthStart, monthEnd] = useMemo(() => currentMonthRange(), []);

  const monthTotal = useMemo(
    () =>
      receipts
        .filter((r) => r.issuedAt >= monthStart && r.issuedAt <= monthEnd)
        .reduce((s, r) => s + r.totalCents, 0),
    [receipts, monthStart, monthEnd],
  );

  const eco = useMemo(() => ecoImpact(receipts.length), [receipts.length]);
  const filtered = useMemo(() => searchReceipts(receipts, query), [receipts, query]);
  const groups = useMemo(() => groupByMonth(filtered), [filtered]);

  return (
    <Screen testID="receipts-screen" padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-5 pb-8">
        {/* En-tête */}
        <View className="flex-row items-center justify-between pb-4 pt-2">
          <View>
            <AppText variant="display" className="text-2xl">
              Mes tickets
            </AppText>
            <AppText variant="caption" className="mt-0.5">
              {receipts.length} document{receipts.length > 1 ? 's' : ''} · zéro papier
            </AppText>
          </View>
          <View className="h-11 w-11 items-center justify-center rounded-pill bg-brand-50">
            <Feather name="shield" size={20} color={colors.brand600} />
          </View>
        </View>

        {/* Carte de tête : dépense du mois + impact évité */}
        <View className="overflow-hidden rounded-card bg-surface-inverse p-5">
          <AppText variant="caption" className="text-ink-inverse/70">
            Dépensé ce mois-ci
          </AppText>
          <AppText
            className="mt-1 font-display text-ink-inverse"
            style={{ fontSize: 32, fontVariant: ['tabular-nums'] }}
          >
            {formatMoney(monthTotal)}
          </AppText>

          <View
            className="mt-4 flex-row gap-2 border-t pt-4"
            style={{ borderTopColor: 'rgba(242,247,240,0.15)' }}
          >
            <EcoStat label="Papier évité" value={formatGrams(eco.paperG)} />
            <EcoStat label="Eau économisée" value={formatLiters(eco.waterL)} />
            <EcoStat label="Tickets" value={String(eco.receipts)} />
          </View>
        </View>

        {/* Recherche */}
        <View
          className="mt-5 flex-row items-center gap-2.5 rounded-control bg-surface-muted px-3.5"
          style={{ height: 46 }}
        >
          <Feather name="search" size={17} color={colors.inkFaint} />
          <TextInput
            testID="receipts-search"
            value={query}
            onChangeText={setQuery}
            placeholder="Enseigne, produit, référence…"
            placeholderTextColor={colors.inkFaint}
            className="flex-1 font-sans text-ink"
            style={{ fontSize: 15 }}
            returnKeyType="search"
            accessibilityLabel="Rechercher un ticket"
          />
          {query ? (
            <Pressable
              testID="receipts-search-clear"
              accessibilityRole="button"
              accessibilityLabel="Effacer la recherche"
              hitSlop={8}
              onPress={() => setQuery('')}
            >
              <Feather name="x" size={17} color={colors.inkFaint} />
            </Pressable>
          ) : null}
        </View>

        {/* Historique groupé par mois */}
        {groups.length === 0 ? (
          <View testID="receipts-empty" className="mt-10 items-center gap-2 px-6">
            <Feather name="inbox" size={30} color={colors.inkFaint} />
            <AppText variant="title" className="mt-1 text-center text-base">
              Aucun ticket trouvé
            </AppText>
            <AppText variant="caption" className="text-center">
              {query
                ? 'Essayez un autre mot — enseigne, produit ou référence.'
                : 'Présentez votre carte TK LINK en caisse : vos tickets arriveront ici.'}
            </AppText>
          </View>
        ) : (
          groups.map((g) => (
            <View key={g.key} className="mt-6 gap-2.5">
              <View className="flex-row items-baseline justify-between">
                <AppText className="font-sans-semibold capitalize text-ink">{g.label}</AppText>
                <AppText
                  variant="caption"
                  className="text-ink-muted"
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  {formatMoney(g.totalCents)}
                </AppText>
              </View>
              {g.receipts.map((r) => (
                <ReceiptRow key={r.id} receipt={r} onPress={() => onOpenReceipt(r.id)} />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

function EcoStat({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 gap-0.5">
      <AppText
        className="font-sans-bold text-lime"
        style={{ fontSize: 15, fontVariant: ['tabular-nums'] }}
      >
        {value}
      </AppText>
      <AppText variant="caption" className="text-ink-inverse/60" style={{ fontSize: 11 }}>
        {label}
      </AppText>
    </View>
  );
}
