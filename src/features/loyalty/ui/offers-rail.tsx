import { Feather } from '@expo/vector-icons';
import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';

import { AppText } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { isOfferLive, timeLeft } from '../lib/loyalty';
import { selectOffers, useLoyaltyStore } from '../model/store';

type Props = {
  /** Combien d'offres montrer avant de renvoyer vers le catalogue complet. */
  limit?: number;
};

/**
 * Les offres membres, en rail — la version courte de l'écran « Offres », faite
 * pour tenir dans le hub entre le déstockage et les jeux.
 *
 * Les offres flash passent devant : ce sont les seules qui expirent, donc les
 * seules qui méritent d'être vues tout de suite.
 */
export function OffersRail({ limit = 6 }: Props) {
  const offers = useLoyaltyStore(selectOffers);

  const shown = useMemo(() => {
    const live = offers.filter((o) => isOfferLive(o));
    return [...live].sort((a, b) => Number(b.flash) - Number(a.flash)).slice(0, limit);
  }, [offers, limit]);

  if (shown.length === 0) {
    return (
      <View
        testID="offers-rail-empty"
        className="mx-5 items-center gap-1 rounded-card bg-surface-muted p-5"
      >
        <Feather name="tag" size={22} color={colors.inkFaint} />
        <AppText variant="caption" className="text-center">
          Aucune offre en cours — elles changent tous les jours.
        </AppText>
      </View>
    );
  }

  return (
    <ScrollView
      testID="offers-rail"
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-3 px-5"
    >
      {shown.map((o) => (
        <View
          key={o.id}
          testID={`offers-rail-${o.id}`}
          accessibilityLabel={`${o.claim} chez ${o.merchant}`}
          className="w-44 overflow-hidden rounded-card border border-line bg-surface"
        >
          <View className="items-center justify-center bg-surface-inverse px-3 py-4">
            <AppText className="text-center font-display text-lime" style={{ fontSize: 17 }}>
              {o.claim}
            </AppText>
          </View>

          <View className="gap-1 p-3">
            <View className="flex-row items-center gap-1.5">
              <AppText
                className="flex-1 font-sans-semibold text-ink"
                style={{ fontSize: 12.5 }}
                numberOfLines={1}
              >
                {o.merchant}
              </AppText>
              {o.flash ? (
                <View className="rounded-pill bg-brand-50 px-1.5 py-0.5">
                  <AppText className="font-sans-bold text-brand-700" style={{ fontSize: 8.5 }}>
                    FLASH
                  </AppText>
                </View>
              ) : null}
            </View>
            <AppText variant="caption" style={{ fontSize: 11.5 }} numberOfLines={2}>
              {o.title}
            </AppText>
            {o.endsAt ? (
              <View className="mt-0.5 flex-row items-center gap-1">
                <Feather name="clock" size={11} color={colors.brand600} />
                <AppText className="font-sans-semibold text-brand-600" style={{ fontSize: 11 }}>
                  {timeLeft(o.endsAt)}
                </AppText>
              </View>
            ) : null}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
