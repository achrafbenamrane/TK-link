import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText, Screen } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

import { nextTier, pointsToGo, reachedCount, tierProgress, tierState } from '../lib/tiers';
import { selectCards, selectTiers, useMerchantLoyaltyStore } from '../model/merchant-store';

type Props = {
  merchantId: string;
  merchantName: string;
  /** Sous-titre : spécialité, note, adresse… */
  merchantMeta?: string;
  onBack: () => void;
};

/**
 * La carte de fidélité d'UNE enseigne — reprise de la maquette du client :
 * le solde en tête, les quatre paliers (atteints, à réclamer, verrouillés),
 * et l'historique. Les points bruts ne se transfèrent pas (CDC V1.1).
 */
export function MerchantLoyaltyScreen({ merchantId, merchantName, merchantMeta, onBack }: Props) {
  const colors = useColors();
  const cards = useMerchantLoyaltyStore(selectCards);
  // Les paliers viennent du commerçant depuis le §8.3, ils ne sont plus figés.
  const tiers = useMerchantLoyaltyStore(selectTiers);
  const claim = useMerchantLoyaltyStore((s) => s.claim);

  const [tab, setTab] = useState<'avantages' | 'historique'>('avantages');

  const card = useMemo(
    () => cards[merchantId] ?? { points: 0, claimed: [], history: [] },
    [cards, merchantId],
  );
  const reached = reachedCount(tiers, card.points);
  const goal = nextTier(tiers, card.points);

  return (
    <Screen testID="merchant-loyalty-screen" padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-5 pb-10">
        {/* Bandeau */}
        <View className="flex-row items-center gap-3 pb-4 pt-2">
          <Pressable
            testID="loyalty-back"
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={10}
            onPress={onBack}
            className="h-9 w-9 items-center justify-center rounded-pill bg-surface-muted"
          >
            <Feather name="chevron-left" size={22} color={colors.ink} />
          </Pressable>
          <View className="flex-1">
            <AppText variant="display" className="text-xl" numberOfLines={1}>
              {merchantName}
            </AppText>
            {merchantMeta ? (
              <AppText variant="caption" numberOfLines={1}>
                {merchantMeta}
              </AppText>
            ) : null}
          </View>
          <View className="flex-row items-center gap-1.5 rounded-pill bg-brand-500 px-3 py-1.5">
            <Feather name="award" size={14} color={colors.inkInverse} />
            <AppText
              className="font-sans-bold text-ink-inverse"
              style={{ fontSize: 14, fontVariant: ['tabular-nums'] }}
            >
              {card.points}
            </AppText>
            <AppText className="text-ink-inverse/80" style={{ fontSize: 11 }}>
              points
            </AppText>
          </View>
        </View>

        {/* Prochain palier */}
        {goal ? (
          <View className="mb-4 gap-2 rounded-card bg-surface-muted p-4">
            <View className="flex-row items-center justify-between">
              <AppText className="font-sans-semibold text-ink">
                Palier {goal.rank}/{tiers.length}
              </AppText>
              <AppText variant="caption" className="text-brand-600">
                encore {pointsToGo(goal, card.points)} points
              </AppText>
            </View>
            <View className="h-2 overflow-hidden rounded-pill bg-surface-sunken">
              <View
                className="h-full rounded-pill bg-brand-500"
                style={{ width: `${Math.round(tierProgress(goal, card.points) * 100)}%` }}
              />
            </View>
          </View>
        ) : (
          <View className="mb-4 flex-row items-center gap-2 rounded-card bg-brand-50 p-4">
            <Feather name="check-circle" size={18} color={colors.brand600} />
            <AppText variant="caption" className="flex-1 text-brand-700">
              Tous les paliers sont débloqués. Bravo !
            </AppText>
          </View>
        )}

        {/* Onglets */}
        <View className="mb-3 flex-row gap-2">
          {[
            { key: 'avantages' as const, label: `Avantages ${reached}/${tiers.length}` },
            { key: 'historique' as const, label: 'Mon historique' },
          ].map((t) => (
            <Pressable
              key={t.key}
              testID={`loyalty-tab-${t.key}`}
              accessibilityRole="button"
              accessibilityLabel={t.label}
              onPress={() => setTab(t.key)}
              className={cn(
                'rounded-pill px-4 py-2',
                tab === t.key ? 'bg-surface-inverse' : 'bg-surface-muted',
              )}
            >
              <AppText
                className={cn(
                  'font-sans-semibold',
                  tab === t.key ? 'text-ink-inverse' : 'text-ink-muted',
                )}
                style={{ fontSize: 13 }}
              >
                {t.label}
              </AppText>
            </Pressable>
          ))}
        </View>

        {/* Paliers */}
        {tab === 'avantages' ? (
          <View className="gap-2.5">
            {tiers.map((tier) => {
              const state = tierState(tier, card.points, card.claimed);
              return (
                <View
                  key={tier.rank}
                  testID={`tier-${tier.rank}`}
                  className="flex-row items-center gap-3 rounded-card bg-surface p-3.5"
                  style={{
                    borderWidth: 1,
                    borderColor: state === 'locked' ? colors.line : colors.brand200,
                  }}
                >
                  <View
                    className="h-12 w-12 items-center justify-center rounded-control"
                    style={{
                      backgroundColor: state === 'locked' ? colors.surfaceSunken : colors.brand50,
                    }}
                  >
                    <Feather
                      name={state === 'locked' ? 'lock' : state === 'claimed' ? 'check' : 'gift'}
                      size={20}
                      color={state === 'locked' ? colors.inkFaint : colors.brand600}
                    />
                  </View>

                  <View className="flex-1 gap-0.5">
                    <View className="flex-row items-center gap-2">
                      <AppText variant="caption" className="text-ink-faint">
                        {tier.rank}/{tiers.length}
                      </AppText>
                      {state === 'available' ? (
                        <View className="rounded-pill bg-brand-500 px-2 py-0.5">
                          <AppText
                            className="font-sans-bold text-ink-inverse"
                            style={{ fontSize: 10 }}
                          >
                            FÉLICITATIONS
                          </AppText>
                        </View>
                      ) : null}
                      {state === 'claimed' ? (
                        <AppText
                          variant="caption"
                          className="text-brand-600"
                          style={{ fontSize: 11 }}
                        >
                          Utilisé
                        </AppText>
                      ) : null}
                    </View>
                    <AppText
                      className={cn(
                        'font-sans-semibold',
                        state === 'locked' ? 'text-ink-faint' : 'text-ink',
                      )}
                      numberOfLines={2}
                    >
                      {tier.reward}
                    </AppText>
                  </View>

                  <View className="items-end gap-1.5">
                    <AppText
                      className="font-sans-bold text-ink"
                      style={{ fontSize: 13, fontVariant: ['tabular-nums'] }}
                    >
                      {tier.cost} pts
                    </AppText>
                    {state === 'available' ? (
                      <Pressable
                        testID={`tier-claim-${tier.rank}`}
                        accessibilityRole="button"
                        accessibilityLabel={`Utiliser ${tier.reward}`}
                        onPress={() => claim(merchantId, tier.rank)}
                        className="h-8 w-8 items-center justify-center rounded-pill bg-brand-500 active:bg-brand-600"
                      >
                        <Feather name="plus" size={17} color={colors.inkInverse} />
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View className="gap-2">
            {card.history.length === 0 ? (
              <View testID="loyalty-history-empty" className="items-center gap-2 py-10">
                <Feather name="clock" size={26} color={colors.inkFaint} />
                <AppText variant="caption">Aucun mouvement pour le moment.</AppText>
              </View>
            ) : (
              card.history.map((h) => (
                <View
                  key={h.id}
                  className="flex-row items-center justify-between rounded-card bg-surface p-3.5"
                  style={{ borderWidth: 1, borderColor: colors.line }}
                >
                  <View>
                    <AppText className="font-sans-medium text-ink" style={{ fontSize: 14 }}>
                      {h.label}
                    </AppText>
                    <AppText variant="caption" className="text-ink-faint">
                      {new Date(h.at).toLocaleDateString('fr-FR')}
                    </AppText>
                  </View>
                  <AppText
                    className={cn(
                      'font-sans-bold',
                      h.points >= 0 ? 'text-brand-600' : 'text-ink-muted',
                    )}
                    style={{ fontVariant: ['tabular-nums'] }}
                  >
                    {h.points >= 0 ? `+${h.points}` : h.points}
                  </AppText>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
