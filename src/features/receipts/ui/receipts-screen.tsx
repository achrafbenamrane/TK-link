import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText, Screen } from '@/shared/ui';
import { BackButton } from '@/shared/ui/back-button';
import { colors } from '@/shared/theme/colors';

import {
  ecoImpact,
  filterReceipts,
  formatGrams,
  formatLiters,
  formatMoney,
  groupByMonth,
} from '../lib/receipts';
import { RETENTION_YEARS } from '../lib/retention';
import { isCustomerFacing, RECEIPT_KIND_LABEL, ReceiptKindSchema } from '../model/schema';
import type { ReceiptKind } from '../model/schema';
import { selectReceipts, useReceiptsStore } from '../model/store';
import { ReceiptRow } from './components/receipt-row';

/**
 * Les types proposés au filtre — CDC §9.1.
 *
 * Le ticket de PRÉPARATION est délibérément absent : le §6.3 en fait un
 * document d'atelier, pour la cuisine ou le comptoir. Il ne sort jamais du
 * commerce, et l'offrir au filtre du client afficherait les coulisses du
 * commerçant. `isCustomerFacing` porte déjà cette règle — on la réutilise au
 * lieu d'écrire la liste à la main, pour qu'un futur type l'hérite tout seul.
 */
const KINDS: ReceiptKind[] = ReceiptKindSchema.options.filter(isCustomerFacing);

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
  /** `null` = tous les types. Voir `filterReceipts`. */
  const [kind, setKind] = useState<ReceiptKind | null>(null);

  const [monthStart, monthEnd] = useMemo(() => currentMonthRange(), []);

  const monthTotal = useMemo(
    () =>
      receipts
        .filter((r) => r.issuedAt >= monthStart && r.issuedAt <= monthEnd)
        .reduce((s, r) => s + r.totalCents, 0),
    [receipts, monthStart, monthEnd],
  );

  const eco = useMemo(() => ecoImpact(receipts.length), [receipts.length]);
  const filtered = useMemo(
    () => filterReceipts(receipts, { query, kind }),
    [receipts, query, kind],
  );
  const groups = useMemo(() => groupByMonth(filtered), [filtered]);

  return (
    <Screen testID="receipts-screen" padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-5 pb-8">
        {/* En-tête */}
        <View className="flex-row items-center justify-between pb-4 pt-2">
          <View>
            <BackButton fallbackHref="/profil" />
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
            placeholder="Enseigne, produit, date, montant…"
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

        {/* Filtre par type — CDC §9.1. Les quatre documents existaient déjà
            dans le modèle mais ne se voyaient nulle part : le client ne pouvait
            pas isoler ses factures de ses tickets, ni retrouver une garantie. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-3"
          contentContainerClassName="gap-2 pr-5"
        >
          <KindChip label="Tous" active={kind === null} onPress={() => setKind(null)} />
          {KINDS.map((k) => (
            <KindChip
              key={k}
              testID={`receipts-kind-${k}`}
              label={RECEIPT_KIND_LABEL[k]}
              active={kind === k}
              // Re-toucher le filtre actif le relâche : sinon il n'existe aucun
              // moyen de revenir à « Tous » sans viser une autre puce.
              onPress={() => setKind((prev) => (prev === k ? null : k))}
            />
          ))}
        </ScrollView>

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
                : 'Vos tickets arrivent ici dès qu’une commande est honorée.'}
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

        {/* CDC §16 — la règle est annoncée, pas seulement appliquée. Un
            document qui disparaît sans qu'on ait jamais dit pourquoi passe
            pour un bug, ou pour une perte de données. */}
        <View
          testID="receipts-retention"
          className="mt-6 flex-row items-start gap-2.5 rounded-card bg-surface-muted p-4"
        >
          <Feather name="clock" size={15} color={colors.inkFaint} />
          <AppText variant="caption" className="flex-1 text-ink-muted">
            Vos documents sont conservés {RETENTION_YEARS} ans, puis supprimés automatiquement.
            Épinglez ceux que vous voulez garder au-delà — une garantie, un litige.
          </AppText>
        </View>
      </ScrollView>
    </Screen>
  );
}

/** Une puce de filtre. Vert plein quand elle est active — l'identité de marque. */
function KindChip({
  label,
  active,
  onPress,
  testID,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`Filtrer sur ${label}`}
      onPress={onPress}
      className={cn(
        'rounded-pill border px-3.5 py-2',
        active ? 'border-brand-500 bg-brand-500' : 'border-line bg-surface',
      )}
    >
      <AppText
        className={cn('font-sans-semibold', active ? 'text-ink-inverse' : 'text-ink-muted')}
        style={{ fontSize: 13 }}
      >
        {label}
      </AppText>
    </Pressable>
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
