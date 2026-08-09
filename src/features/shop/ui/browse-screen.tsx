import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText, Screen } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import {
  flashLabel,
  searchSummaries,
  sortSummaries,
  summarize,
  SORT_LABEL,
  type SortKey,
} from '../lib/browse';
import { formatDistance } from '../lib/geo';
import { filterDeals } from '../lib/preferences';
import { DEALS, getMerchant } from '../model/catalog';
import { useShopStore } from '../model/store';
import { CategoryBar } from './components/category-bar';
import { DealsMap } from './map-view';
import type { Category } from '../model/schema';

type Props = {
  /** Points de fidélité par enseigne, injectés par la route. */
  loyaltyByMerchant?: Record<string, number>;
  onOpenMerchant: (merchantId: string) => void;
};

const SORTS: SortKey[] = ['derniere-chance', 'proximite', 'note'];

/**
 * PARCOURIR — la découverte par COMMERCE.
 *
 * À ne pas confondre avec l'accueil : là on déroule les ventes flash une par
 * une, ici on cherche une enseigne et on voit combien de flashs elle propose,
 * à quelle distance, et où en est sa fidélité. Deux questions différentes,
 * deux écrans.
 */
export function BrowseScreen({ loyaltyByMerchant, onOpenMerchant }: Props) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [sort, setSort] = useState<SortKey>('derniere-chance');
  const [asMap, setAsMap] = useState(false);

  const preferences = useShopStore((s) => s.preferences);
  const userCoord = useShopStore((s) => s.userCoord);

  // Les mêmes préférences qu'ailleurs : une enseigne écartée par « Ma Fan Zone »
  // ne doit pas réapparaître ici.
  const { deals, radiusRelaxed } = useMemo(() => {
    const byCat = category ? DEALS.filter((d) => d.category === category) : DEALS;
    return filterDeals(byCat, getMerchant, preferences, userCoord);
  }, [category, preferences, userCoord]);

  const list = useMemo(() => {
    const base = summarize(deals, getMerchant, userCoord);
    return sortSummaries(searchSummaries(base, deals, query), sort);
  }, [deals, query, sort, userCoord]);

  return (
    <Screen testID="browse-screen" padded={false}>
      <View className="px-5 pb-3 pt-2">
        <View className="flex-row items-center justify-between">
          <AppText variant="display" className="text-2xl">
            Parcourir
          </AppText>
          <Pressable
            testID="browse-view-toggle"
            accessibilityRole="button"
            accessibilityLabel={asMap ? 'Voir la liste' : 'Voir la carte'}
            onPress={() => setAsMap((v) => !v)}
            className="flex-row items-center gap-1.5 rounded-pill bg-surface-muted px-3 py-2"
          >
            <Feather name={asMap ? 'list' : 'map'} size={15} color={colors.ink} />
            <AppText className="font-sans-semibold text-ink" style={{ fontSize: 13 }}>
              {asMap ? 'Liste' : 'Carte'}
            </AppText>
          </Pressable>
        </View>

        {/* Recherche */}
        <View
          className="mt-3 flex-row items-center gap-2.5 rounded-control bg-surface-muted px-3.5"
          style={{ height: 46 }}
        >
          <Feather name="search" size={17} color={colors.inkFaint} />
          <TextInput
            testID="browse-search"
            value={query}
            onChangeText={setQuery}
            placeholder="Rechercher un commerce ou un article"
            placeholderTextColor={colors.inkFaint}
            className="flex-1 font-sans text-ink"
            style={{ fontSize: 15 }}
            returnKeyType="search"
            accessibilityLabel="Rechercher un commerce"
          />
          {query ? (
            <Pressable
              testID="browse-search-clear"
              accessibilityRole="button"
              accessibilityLabel="Effacer"
              hitSlop={8}
              onPress={() => setQuery('')}
            >
              <Feather name="x" size={17} color={colors.inkFaint} />
            </Pressable>
          ) : null}
        </View>

        {/* Tri */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2 pt-3"
        >
          {SORTS.map((s) => (
            <Pressable
              key={s}
              testID={`browse-sort-${s}`}
              accessibilityRole="button"
              accessibilityLabel={SORT_LABEL[s]}
              accessibilityState={{ selected: sort === s }}
              onPress={() => setSort(s)}
              className={cn('rounded-pill px-3.5 py-2', sort === s ? 'bg-ink' : 'bg-surface-muted')}
            >
              <AppText
                className={cn(
                  'font-sans-semibold',
                  sort === s ? 'text-ink-inverse' : 'text-ink-muted',
                )}
                style={{ fontSize: 12.5 }}
              >
                {SORT_LABEL[s]}
              </AppText>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <CategoryBar value={category} onChange={setCategory} />

      {/* Hors zone couverte : on montre tout plutôt qu'un écran vide, et on le dit. */}
      {radiusRelaxed ? (
        <View className="flex-row items-center gap-2 px-5 pt-3" testID="browse-radius-relaxed">
          <Feather name="navigation" size={13} color={colors.inkFaint} />
          <AppText variant="caption" className="flex-1 text-ink-faint">
            Aucun commerce à moins de {preferences.radiusKm} km — voici tous les autres.
          </AppText>
        </View>
      ) : null}

      {asMap ? (
        <View className="flex-1">
          <DealsMap deals={deals} category={category} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-5 pb-8 pt-3">
          {list.length === 0 ? (
            <View testID="browse-empty" className="mt-10 items-center gap-2 px-6">
              <Feather name="search" size={28} color={colors.inkFaint} />
              <AppText variant="title" className="mt-1 text-center text-base">
                Aucun commerce trouvé
              </AppText>
              <AppText variant="caption" className="text-center">
                Élargissez votre Fan Zone ou changez de catégorie.
              </AppText>
            </View>
          ) : (
            <View className="gap-3">
              {list.map((s) => {
                const points = loyaltyByMerchant?.[s.merchant.id];
                return (
                  <Pressable
                    key={s.merchant.id}
                    testID={`browse-merchant-${s.merchant.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={s.merchant.name}
                    onPress={() => onOpenMerchant(s.merchant.id)}
                    className="flex-row items-center gap-3 rounded-card bg-surface p-3.5 active:opacity-80"
                    style={{ borderWidth: 1, borderColor: colors.line }}
                  >
                    <View className="h-14 w-14 items-center justify-center rounded-control bg-surface-muted">
                      <AppText style={{ fontSize: 26 }}>{s.merchant.emoji}</AppText>
                    </View>

                    <View className="flex-1 gap-1">
                      <AppText className="font-sans-bold text-ink" numberOfLines={1}>
                        {s.merchant.name}
                      </AppText>

                      {/* « en ce moment 3 FLASHS » */}
                      <View className="flex-row items-center gap-1.5 self-start rounded-pill bg-ink px-2 py-1">
                        <Feather name="zap" size={10} color={colors.inkInverse} />
                        <AppText
                          className="font-sans-bold text-ink-inverse"
                          style={{ fontSize: 10 }}
                        >
                          {flashLabel(s.flashCount)}
                        </AppText>
                      </View>

                      <View className="flex-row items-center gap-2.5">
                        {s.distanceKm !== null ? (
                          <AppText
                            variant="caption"
                            className="text-ink-faint"
                            style={{ fontSize: 12 }}
                          >
                            {formatDistance(s.distanceKm)}
                          </AppText>
                        ) : null}
                        <AppText
                          variant="caption"
                          className="text-ink-faint"
                          style={{ fontSize: 12 }}
                        >
                          ★ {s.merchant.rating}
                        </AppText>
                        <AppText
                          variant="caption"
                          className="text-ink-faint"
                          style={{ fontSize: 12 }}
                        >
                          {s.merchant.area}
                        </AppText>
                      </View>
                    </View>

                    <View className="items-end gap-1.5">
                      {s.bestDiscount ? (
                        <View className="rounded-pill bg-brand-500 px-2 py-0.5">
                          <AppText
                            className="font-sans-bold text-ink-inverse"
                            style={{ fontSize: 11 }}
                          >
                            -{s.bestDiscount}%
                          </AppText>
                        </View>
                      ) : null}
                      {points !== undefined ? (
                        <View className="items-end rounded-control bg-brand-50 px-2 py-1">
                          <AppText
                            className="font-sans-bold text-brand-700"
                            style={{ fontSize: 12, fontVariant: ['tabular-nums'] }}
                          >
                            {points} pts
                          </AppText>
                          <AppText className="text-brand-700/70" style={{ fontSize: 9 }}>
                            fidélité
                          </AppText>
                        </View>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}
