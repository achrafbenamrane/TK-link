import { Feather } from '@expo/vector-icons';
import { useMemo, useRef } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText, Screen, ThemeToggle } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

import { nextTier, pointsToGo, tierProgress, tierState, UNIT_LABEL } from '../lib/tiers';
import {
  programOf,
  selectCards,
  selectPrograms,
  useMerchantLoyaltyStore,
} from '../model/merchant-store';

type Props = {
  merchantId: string;
  merchantName: string;
  /** Note et quartier du commerce — l'en-tête de la maquette. */
  merchantRating?: number;
  merchantArea?: string;
  /** « Ouvert » ou « Fermé » quand les horaires sont connus. */
  openState?: 'open' | 'closed';
  /** Ouvre l'inventaire de récompenses (QR, partage) — fourni par la route. */
  onOpenRewards?: () => void;
  onBack: () => void;
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

const MONTHS = [
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
const dateLabel = (ms: number) => {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

/**
 * LA FIDÉLITÉ CHEZ UN COMMERCE — la maquette « Fidélité chez un commerce » du client :
 * l'identité du commerce, le solde de points et la progression, « Mes récompenses »
 * (disponible → « Utiliser », à débloquer → cadenas) et « Historique des points ».
 *
 * La maquette propose « Transférer des points » : le CDC V1.1 l'interdit (« les points
 * bruts ne sont jamais transférables ») — le CDC gagne. La place est donnée à « Mes
 * récompenses », l'inventaire où se partage une récompense DÉBLOQUÉE.
 */
export function MerchantLoyaltyScreen({
  merchantId,
  merchantName,
  merchantRating,
  merchantArea,
  openState,
  onOpenRewards,
  onBack,
}: Props) {
  const colors = useColors();
  const cards = useMerchantLoyaltyStore(selectCards);
  const programs = useMerchantLoyaltyStore(selectPrograms);
  const { tiers, unit } = programOf(programs, merchantId);
  const claim = useMerchantLoyaltyStore((s) => s.claim);

  const scrollRef = useRef<ScrollView>(null);
  const historyY = useRef(0);

  const card = useMemo(
    () => cards[merchantId] ?? { points: 0, claimed: [], history: [] },
    [cards, merchantId],
  );
  const goal = nextTier(tiers, card.points);
  const pct = goal ? Math.round(tierProgress(goal, card.points) * 100) : 100;

  return (
    <Screen testID="merchant-loyalty-screen" padded={false}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerClassName="gap-3.5 px-5 pb-10"
      >
        {/* Retour · Nuit/Jour */}
        <View className="flex-row items-center justify-between pt-2">
          <Pressable
            testID="loyalty-back"
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={10}
            onPress={onBack}
          >
            <Feather name="arrow-left" size={24} color={colors.ink} />
          </Pressable>
          <ThemeToggle />
        </View>

        {/* Identité du commerce */}
        <View className="flex-row items-center gap-3.5">
          <View className="h-16 w-16 items-center justify-center rounded-pill border-2 border-brand-500 bg-surface-muted">
            <AppText className="font-display text-brand-500" style={{ fontSize: 22 }}>
              {initials(merchantName)}
            </AppText>
          </View>
          <View className="flex-1 gap-1">
            <AppText className="font-display text-ink" style={{ fontSize: 21 }} numberOfLines={1}>
              {merchantName}
            </AppText>
            <View className="flex-row items-center gap-3">
              {merchantRating !== undefined ? (
                <View className="flex-row items-center gap-1">
                  <Feather name="star" size={13} color={colors.warning} />
                  <AppText className="font-sans-semibold text-ink" style={{ fontSize: 13 }}>
                    {merchantRating}
                  </AppText>
                </View>
              ) : null}
              {merchantArea ? (
                <View className="flex-1 flex-row items-center gap-1">
                  <Feather name="map-pin" size={13} color={colors.accent} />
                  <AppText variant="caption" className="flex-1 text-ink-muted" numberOfLines={1}>
                    {merchantArea}
                  </AppText>
                </View>
              ) : null}
            </View>
          </View>
          {openState ? (
            <View
              className={cn(
                'rounded-control border px-2.5 py-1',
                openState === 'open' ? 'border-success' : 'border-danger',
              )}
            >
              <AppText
                className={cn(
                  'font-sans-bold',
                  openState === 'open' ? 'text-success' : 'text-danger',
                )}
                style={{ fontSize: 11 }}
              >
                {openState === 'open' ? 'OUVERT' : 'FERMÉ'}
              </AppText>
            </View>
          ) : null}
        </View>

        {/* Le solde et la progression */}
        <View
          testID="loyalty-balance"
          className="gap-2 rounded-card border border-brand-500 bg-surface-muted p-4"
        >
          <View className="flex-row items-center gap-4">
            <View className="h-16 w-16 items-center justify-center rounded-pill bg-brand-500">
              <Feather name="star" size={30} color="#FFFFFF" />
            </View>
            <View className="flex-1">
              <AppText className="font-display text-brand-500" style={{ fontSize: 30 }}>
                {card.points}{' '}
                <AppText className="font-sans-bold text-ink" style={{ fontSize: 17 }}>
                  points
                </AppText>
              </AppText>
              <AppText variant="caption" className="text-ink-muted">
                Ton solde fidélité chez {merchantName}
              </AppText>
            </View>
          </View>
          <View className="flex-row items-center gap-3">
            <View className="h-2 flex-1 overflow-hidden rounded-pill bg-surface-sunken">
              <View className="h-full rounded-pill bg-brand-500" style={{ width: `${pct}%` }} />
            </View>
            <AppText className="text-ink-muted" style={{ fontSize: 12 }}>
              {pct}%
            </AppText>
          </View>
          <AppText
            testID="loyalty-next"
            variant="caption"
            className="text-center text-ink-muted"
            style={{ fontSize: 11.5 }}
          >
            {goal
              ? `Plus que ${pointsToGo(goal, card.points)} points avant votre prochain palier : ${goal.reward}`
              : 'Tous les paliers sont débloqués. Bravo !'}
          </AppText>
          <AppText
            testID="loyalty-rule"
            variant="caption"
            className="text-center text-ink-faint"
            style={{ fontSize: 10.5 }}
          >
            {UNIT_LABEL[unit].rule} chez {merchantName}. Les points ne sont ni transférables ni
            convertibles en euros.
          </AppText>
        </View>

        {card.points === 0 && card.history.length === 0 ? (
          <View
            testID="loyalty-first-hint"
            className="flex-row items-center gap-2.5 rounded-card bg-brand-50 p-3.5"
          >
            <Feather name="zap" size={16} color={colors.brand600} />
            <AppText variant="caption" className="flex-1 text-brand-700">
              Passez une première commande chez {merchantName} : vos points arrivent tout de suite.
            </AppText>
          </View>
        ) : null}

        {/* Mes récompenses · Mon historique */}
        <View className="flex-row gap-3">
          <Pressable
            testID="loyalty-open-rewards"
            accessibilityRole="button"
            accessibilityLabel="Mes récompenses débloquées"
            onPress={onOpenRewards}
            disabled={!onOpenRewards}
            className="flex-1 flex-row items-center justify-center gap-2 rounded-pill border border-line bg-surface-muted py-3"
          >
            <Feather name="gift" size={15} color={colors.brand500} />
            <AppText className="text-ink" style={{ fontSize: 13 }}>
              Mes récompenses
            </AppText>
          </Pressable>
          <Pressable
            testID="loyalty-open-history"
            accessibilityRole="button"
            accessibilityLabel="Mon historique"
            onPress={() => scrollRef.current?.scrollTo({ y: historyY.current, animated: true })}
            className="flex-1 flex-row items-center justify-center gap-2 rounded-pill border border-line bg-surface-muted py-3"
          >
            <Feather name="clock" size={15} color={colors.brand500} />
            <AppText className="text-ink" style={{ fontSize: 13 }}>
              Mon historique
            </AppText>
          </Pressable>
        </View>

        {/* Mes récompenses : les paliers */}
        <View className="flex-row items-center gap-2">
          <Feather name="gift" size={14} color={colors.brand500} />
          <AppText className="font-sans-semibold text-ink" style={{ fontSize: 13 }}>
            Mes récompenses
          </AppText>
        </View>
        <View className="gap-2">
          {tiers.map((tier) => {
            const state = tierState(tier, card.points, card.claimed);
            return (
              <View
                key={tier.rank}
                testID={`tier-${tier.rank}`}
                className="flex-row items-center gap-3 overflow-hidden rounded-control border border-line bg-surface-muted pr-3"
              >
                <View
                  className={cn(
                    'h-14 w-14 items-center justify-center',
                    state === 'locked' ? 'bg-surface-sunken' : 'bg-brand-50',
                  )}
                >
                  <Feather
                    name="gift"
                    size={22}
                    color={state === 'locked' ? colors.inkFaint : colors.brand500}
                  />
                </View>
                <View className="flex-1 py-2">
                  <AppText style={{ fontSize: 13.5 }} className="text-ink">
                    <AppText className="font-sans-bold text-brand-500" style={{ fontSize: 13.5 }}>
                      {tier.cost}
                    </AppText>{' '}
                    points
                  </AppText>
                  <AppText variant="caption" className="text-ink-muted" numberOfLines={2}>
                    {tier.reward}
                  </AppText>
                </View>
                <View className="items-end gap-1">
                  <View
                    className={cn(
                      'rounded-sm border px-1.5 py-0.5',
                      state === 'available'
                        ? 'border-brand-500'
                        : state === 'claimed'
                          ? 'border-success'
                          : 'border-warning',
                    )}
                  >
                    <AppText
                      className={cn(
                        'font-sans-bold',
                        state === 'available'
                          ? 'text-brand-500'
                          : state === 'claimed'
                            ? 'text-success'
                            : 'text-warning',
                      )}
                      style={{ fontSize: 8.5 }}
                    >
                      {state === 'available'
                        ? 'DISPONIBLE'
                        : state === 'claimed'
                          ? 'DÉBLOQUÉE'
                          : 'À DÉBLOQUER'}
                    </AppText>
                  </View>
                  {state === 'available' ? (
                    <Pressable
                      testID={`tier-claim-${tier.rank}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Utiliser ${tier.reward}`}
                      onPress={() => claim(merchantId, tier.rank, merchantName)}
                      className="rounded-pill bg-brand-500 px-4 py-1.5 active:bg-brand-600"
                    >
                      <AppText className="font-sans-bold text-white" style={{ fontSize: 12 }}>
                        Utiliser
                      </AppText>
                    </Pressable>
                  ) : state === 'locked' ? (
                    <View className="h-7 w-7 items-center justify-center rounded-pill border border-warning">
                      <Feather name="lock" size={13} color={colors.warning} />
                    </View>
                  ) : (
                    <Feather name="check-circle" size={20} color={colors.success} />
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Historique des points */}
        <View onLayout={(e) => (historyY.current = e.nativeEvent.layout.y)}>
          <AppText className="mb-2 font-sans-semibold text-ink" style={{ fontSize: 14 }}>
            Historique des points
          </AppText>
          {card.history.length === 0 ? (
            <View testID="loyalty-history-empty" className="items-center gap-2 py-6">
              <Feather name="clock" size={24} color={colors.inkFaint} />
              <AppText variant="caption">Aucun mouvement pour le moment.</AppText>
            </View>
          ) : (
            <View className="overflow-hidden rounded-control border border-line bg-surface-muted">
              {card.history.map((h, i) => (
                <View
                  key={h.id}
                  testID={`history-${h.id}`}
                  className={cn(
                    'flex-row items-center gap-3 px-3 py-2.5',
                    i < card.history.length - 1 && 'border-b border-line',
                  )}
                >
                  <View className="h-8 w-8 items-center justify-center rounded-control bg-brand-50">
                    <Feather
                      name={h.label === 'Commande' ? 'shopping-bag' : 'star'}
                      size={15}
                      color={colors.brand500}
                    />
                  </View>
                  <View className="flex-1">
                    <AppText className="text-ink" style={{ fontSize: 13 }}>
                      {h.label}
                    </AppText>
                    <AppText variant="caption" className="text-ink-faint" style={{ fontSize: 11 }}>
                      {dateLabel(h.at)}
                    </AppText>
                  </View>
                  <AppText
                    className={cn('font-sans-bold', h.points >= 0 ? 'text-success' : 'text-danger')}
                    style={{ fontSize: 13, fontVariant: ['tabular-nums'] }}
                  >
                    {h.points >= 0 ? `+${h.points}` : h.points} points
                  </AppText>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
