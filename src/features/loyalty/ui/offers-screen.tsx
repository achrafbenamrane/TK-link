import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText, Screen } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { isOfferLive, timeLeft } from '../lib/loyalty';
import { selectOffers, useLoyaltyStore } from '../model/store';

/**
 * PROMO + CATALOGUE — les deux entrées du menu de la vidéo, réunies : ce sont
 * les mêmes offres, vues sous deux angles. « Flash » met en avant les offres
 * TKtime réservées aux membres, qui expirent ; « Tout » est le catalogue.
 */
type Filter = 'flash' | 'all';

export function OffersScreen() {
  const offers = useLoyaltyStore(selectOffers);
  const [filter, setFilter] = useState<Filter>('flash');

  const live = useMemo(() => offers.filter((o) => isOfferLive(o)), [offers]);
  const shown = useMemo(
    () => (filter === 'flash' ? live.filter((o) => o.flash) : live),
    [live, filter],
  );

  return (
    <Screen testID="offers-screen" padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-5 pb-8">
        <View className="pb-4 pt-2">
          <AppText variant="display" className="text-2xl">
            Offres
          </AppText>
          <AppText variant="caption" className="mt-0.5">
            Réservées aux porteurs de la carte TK LINK.
          </AppText>
        </View>

        {/* Filtres */}
        <View className="flex-row gap-2">
          {(
            [
              { key: 'flash' as const, label: 'Offres flash' },
              { key: 'all' as const, label: 'Tout le catalogue' },
            ] satisfies { key: Filter; label: string }[]
          ).map((f) => (
            <Pressable
              key={f.key}
              testID={`offers-filter-${f.key}`}
              accessibilityRole="button"
              accessibilityLabel={f.label}
              onPress={() => setFilter(f.key)}
              className={cn(
                'rounded-pill px-4 py-2',
                filter === f.key ? 'bg-brand-500' : 'bg-surface-muted',
              )}
            >
              <AppText
                className={cn(
                  'font-sans-semibold',
                  filter === f.key ? 'text-ink-inverse' : 'text-ink-muted',
                )}
                style={{ fontSize: 13 }}
              >
                {f.label}
              </AppText>
            </Pressable>
          ))}
        </View>

        {/* Liste */}
        {shown.length === 0 ? (
          <View testID="offers-empty" className="mt-10 items-center gap-2 px-6">
            <Feather name="tag" size={30} color={colors.inkFaint} />
            <AppText variant="title" className="mt-1 text-center text-base">
              Aucune offre en cours
            </AppText>
            <AppText variant="caption" className="text-center">
              Revenez bientôt : les offres flash changent tous les jours.
            </AppText>
          </View>
        ) : (
          <View className="mt-4 gap-3">
            {shown.map((o) => (
              <View
                key={o.id}
                testID={`offer-${o.id}`}
                className="overflow-hidden rounded-card bg-surface"
                style={{ borderWidth: 1, borderColor: colors.line }}
              >
                <View className="flex-row items-stretch">
                  {/* Le « claim », en pastille verte comme sur l'affiche */}
                  <View
                    className="items-center justify-center bg-surface-inverse px-4 py-5"
                    style={{ minWidth: 96 }}
                  >
                    <AppText
                      className="text-center font-display text-lime"
                      style={{ fontSize: 18 }}
                    >
                      {o.claim}
                    </AppText>
                  </View>

                  <View className="flex-1 gap-0.5 p-4">
                    <View className="flex-row items-center gap-1.5">
                      <AppText className="flex-1 font-sans-semibold text-ink" numberOfLines={1}>
                        {o.merchant}
                      </AppText>
                      {o.flash ? (
                        <View className="rounded-pill bg-brand-50 px-2 py-0.5">
                          <AppText
                            className="font-sans-bold text-brand-700"
                            style={{ fontSize: 10 }}
                          >
                            FLASH
                          </AppText>
                        </View>
                      ) : null}
                    </View>
                    <AppText variant="caption" numberOfLines={1}>
                      {o.title}
                    </AppText>
                    <View className="mt-1.5 flex-row items-center gap-3">
                      {o.category ? (
                        <AppText
                          variant="caption"
                          className="text-ink-faint"
                          style={{ fontSize: 12 }}
                        >
                          {o.category}
                        </AppText>
                      ) : null}
                      {o.endsAt ? (
                        <View className="flex-row items-center gap-1">
                          <Feather name="clock" size={12} color={colors.brand600} />
                          <AppText
                            className="font-sans-semibold text-brand-600"
                            style={{ fontSize: 12 }}
                          >
                            {timeLeft(o.endsAt)}
                          </AppText>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        <View className="mt-6 flex-row items-center gap-2 rounded-card bg-surface-muted p-4">
          <Feather name="credit-card" size={17} color={colors.brand600} />
          <AppText variant="caption" className="flex-1 text-ink-muted">
            Présentez votre carte en caisse : la remise s’applique et vos points sont crédités
            automatiquement.
          </AppText>
        </View>
      </ScrollView>
    </Screen>
  );
}
