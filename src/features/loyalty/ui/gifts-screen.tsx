import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { AppText, Screen } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { canClaim, pointsMissing, progressToward } from '../lib/loyalty';
import {
  selectBalance,
  selectCard,
  selectClaimedGiftIds,
  selectGifts,
  useLoyaltyStore,
} from '../model/store';

type Props = { onBack: () => void };

/** CADEAUX — on échange ses points. Le palier atteignable est mis en avant. */
export function GiftsScreen({ onBack }: Props) {
  const gifts = useLoyaltyStore(selectGifts);
  const balance = useLoyaltyStore(selectBalance);
  const card = useLoyaltyStore(selectCard);
  const claimedIds = useLoyaltyStore(selectClaimedGiftIds);
  const claimGift = useLoyaltyStore((s) => s.claimGift);
  const [justClaimed, setJustClaimed] = useState<string | null>(null);

  const holderType = card?.holderType ?? 'particulier';

  // Cadeaux du public de l'utilisateur, les accessibles d'abord.
  const visible = useMemo(
    () =>
      gifts
        .filter((g) => g.audience === null || g.audience === holderType)
        .sort((a, b) => a.cost - b.cost),
    [gifts, holderType],
  );

  return (
    <Screen testID="gifts-screen" padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-5 pb-8">
        <View className="flex-row items-center gap-3 pb-4 pt-2">
          <Pressable
            testID="gifts-back"
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={10}
            onPress={onBack}
            className="h-9 w-9 items-center justify-center rounded-pill bg-surface-muted"
          >
            <Feather name="chevron-left" size={22} color={colors.ink} />
          </Pressable>
          <View className="flex-1">
            <AppText variant="display" className="text-2xl">
              Cadeaux
            </AppText>
            <AppText variant="caption" className="mt-0.5">
              <AppText className="font-sans-bold text-ink">{balance} points</AppText> disponibles
            </AppText>
          </View>
        </View>

        <View className="gap-3">
          {visible.map((g) => {
            const affordable = canClaim(g, balance, holderType);
            const claimed = claimedIds.includes(g.id);
            const missing = pointsMissing(g, balance);
            return (
              <View
                key={g.id}
                testID={`gift-${g.id}`}
                className="gap-3 rounded-card bg-surface p-4"
                style={{
                  borderWidth: 1,
                  borderColor: affordable ? colors.brand200 : colors.line,
                }}
              >
                <View className="flex-row items-start gap-3">
                  <View
                    className="h-11 w-11 items-center justify-center rounded-control"
                    style={{ backgroundColor: affordable ? colors.brand50 : colors.surfaceSunken }}
                  >
                    <Feather
                      name="gift"
                      size={20}
                      color={affordable ? colors.brand600 : colors.inkFaint}
                    />
                  </View>
                  <View className="flex-1 gap-0.5">
                    <AppText className="font-sans-semibold text-ink">{g.title}</AppText>
                    {g.partner ? (
                      <AppText variant="caption" className="text-ink-faint">
                        {g.partner}
                      </AppText>
                    ) : null}
                    {g.detail ? (
                      <AppText variant="caption" className="mt-0.5">
                        {g.detail}
                      </AppText>
                    ) : null}
                  </View>
                  <View className="items-end">
                    <AppText
                      className="font-sans-bold text-ink"
                      style={{ fontVariant: ['tabular-nums'] }}
                    >
                      {g.cost}
                    </AppText>
                    <AppText variant="caption" className="text-ink-faint" style={{ fontSize: 11 }}>
                      points
                    </AppText>
                  </View>
                </View>

                {/* Progression quand ce n'est pas encore atteignable */}
                {!affordable ? (
                  <View className="gap-1.5">
                    <View className="h-1.5 overflow-hidden rounded-pill bg-surface-sunken">
                      <View
                        className="h-full rounded-pill bg-brand-200"
                        style={{ width: `${Math.round(progressToward(g, balance) * 100)}%` }}
                      />
                    </View>
                    <AppText variant="caption" className="text-ink-faint" style={{ fontSize: 12 }}>
                      Encore {missing} points
                    </AppText>
                  </View>
                ) : (
                  <Pressable
                    testID={`gift-claim-${g.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Échanger ${g.title}`}
                    onPress={() => {
                      if (claimGift(g.id)) setJustClaimed(g.id);
                    }}
                    className="items-center rounded-control bg-brand-500 py-3 active:bg-brand-600"
                  >
                    <AppText className="font-sans-bold text-ink-inverse">
                      Échanger contre {g.cost} points
                    </AppText>
                  </Pressable>
                )}

                {claimed || justClaimed === g.id ? (
                  <View className="flex-row items-center gap-1.5">
                    <Feather name="check-circle" size={14} color={colors.brand600} />
                    <AppText variant="caption" className="text-brand-700">
                      Déjà échangé — présentez ce code au commerçant.
                    </AppText>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}
