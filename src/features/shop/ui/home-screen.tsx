import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { AppText, Screen, TextField } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { activeFilterCount, applyPreferences } from '../lib/preferences';
import { dealsByCategory, getDeal, getMerchant, FEATURED_DEAL_ID } from '../model/catalog';
import type { Category, Deal } from '../model/schema';
import { getUserCoord } from '../lib/location';
import { selectCartCount, useShopStore } from '../model/store';
import { CategoryBar } from './components/category-bar';
import { Countdown } from './components/countdown';
import { FlashCard } from './components/flash-card';
import { ProductImage } from './components/product-image';
import { ViewSwitch, type HomeView } from './components/view-switch';
import { DealsMap } from './map-view';

function CartButton() {
  const router = useRouter();
  const count = useShopStore(selectCartCount);
  return (
    <Pressable
      testID="home-cart"
      accessibilityLabel="Voir le panier"
      onPress={() => router.push('/panier')}
      className="h-10 w-10 items-center justify-center rounded-pill bg-surface-muted"
    >
      <Feather name="shopping-bag" size={19} color={colors.ink} />
      {count > 0 ? (
        <View className="absolute -right-1 -top-1 h-5 min-w-[20px] items-center justify-center rounded-pill bg-brand-500 px-1">
          <AppText className="font-sans-bold text-ink-inverse" style={{ fontSize: 10 }}>
            {count}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Accès à « Ma Fan Zone » — la pastille compte les filtres actifs. */
function PreferencesButton() {
  const router = useRouter();
  const preferences = useShopStore((s) => s.preferences);
  const count = activeFilterCount(preferences);
  return (
    <Pressable
      testID="home-preferences"
      accessibilityRole="button"
      accessibilityLabel="Mes préférences de recherche"
      onPress={() => router.push('/preferences')}
      className="h-10 w-10 items-center justify-center rounded-pill bg-surface-muted"
    >
      <Feather name="sliders" size={18} color={colors.ink} />
      {count > 0 ? (
        <View className="absolute -right-1 -top-1 h-5 min-w-[20px] items-center justify-center rounded-pill bg-brand-500 px-1">
          <AppText className="font-sans-bold text-ink-inverse" style={{ fontSize: 10 }}>
            {count}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

function FeaturedBanner({ deal }: { deal: Deal }) {
  const router = useRouter();
  return (
    <Pressable
      testID="featured-deal"
      onPress={() => router.push({ pathname: '/produit/[id]', params: { id: deal.id } })}
      className="mx-5 mb-5 overflow-hidden rounded-card bg-ink"
    >
      <View className="flex-row items-center gap-3 p-3.5">
        <View
          className="h-20 w-20 items-center justify-center rounded-control"
          style={{ backgroundColor: deal.tint }}
        >
          <ProductImage deal={deal} emojiSize={42} />
        </View>
        <View className="flex-1 gap-1">
          <View className="flex-row items-center gap-2">
            <View className="flex-row items-center gap-1 rounded-pill bg-brand-500 px-2 py-0.5">
              <Feather name="zap" size={10} color={colors.inkInverse} />
              <AppText className="font-sans-bold text-ink-inverse" style={{ fontSize: 9 }}>
                VENTE FLASH
              </AppText>
            </View>
            <Countdown seconds={deal.endsInSeconds} className="text-xs text-ink-inverse" />
          </View>
          <AppText
            className="font-display text-ink-inverse"
            style={{ fontSize: 15 }}
            numberOfLines={1}
          >
            {deal.title}
          </AppText>
          <View className="flex-row items-baseline gap-1.5">
            <AppText className="font-display text-lg text-ink-inverse">
              {deal.price.toFixed(2)}€
            </AppText>
            {deal.oldPrice ? (
              <AppText className="text-xs text-ink-inverse/60 line-through">
                {deal.oldPrice.toFixed(2)}€
              </AppText>
            ) : null}
          </View>
        </View>
        <Feather name="chevron-right" size={22} color={colors.inkInverse} />
      </View>
    </Pressable>
  );
}

type HomeScreenProps = {
  /** Vue d'ouverture : « Parcourir » entre directement sur la carte. */
  initialView?: HomeView;
};

export function HomeScreen({ initialView = 'liste' }: HomeScreenProps = {}) {
  const [category, setCategory] = useState<Category | null>(null);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<HomeView>(initialView);
  const setUserCoord = useShopStore((s) => s.setUserCoord);

  // Position demandée UNE fois pour tout l'écran : les cartes et la carte
  // géographique lisent ensuite la même valeur dans le store.
  useEffect(() => {
    let alive = true;
    getUserCoord().then((coord) => {
      if (alive && coord) setUserCoord(coord);
    });
    return () => {
      alive = false;
    };
  }, [setUserCoord]);

  const preferences = useShopStore((s) => s.preferences);
  const userCoord = useShopStore((s) => s.userCoord);

  const deals = useMemo(() => {
    let list = dealsByCategory(category);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          getMerchant(d.merchantId)?.name.toLowerCase().includes(q),
      );
    }
    // « Ma Fan Zone » agit ici : régimes et rayon écartent réellement des offres.
    return applyPreferences(list, getMerchant, preferences, userCoord);
  }, [category, query, preferences, userCoord]);

  const featured = getDeal(FEATURED_DEAL_ID);

  return (
    <Screen padded={false} testID="home-screen">
      <View className="flex-row items-center justify-between px-5 pb-3 pt-2">
        <View>
          <AppText className="font-display text-ink" style={{ fontSize: 20 }}>
            TK<AppText className="text-brand-500"> LINK</AppText>
          </AppText>
          <View className="mt-0.5 flex-row items-center gap-1">
            <Feather name="map-pin" size={12} color={colors.inkFaint} />
            <AppText variant="caption" className="text-ink-faint">
              Toulouse · Centre
            </AppText>
          </View>
        </View>
        <View className="flex-row items-center gap-2">
          <ViewSwitch value={view} onChange={setView} />
          <PreferencesButton />
          <CartButton />
        </View>
      </View>

      {/* Vue carte : même état de filtre que la liste, un seul `deals`. */}
      {view === 'carte' ? (
        <View className="flex-1">
          <CategoryBar value={category} onChange={setCategory} />
          {/* Pas d'`overflow-hidden` ici : il ne servait à rien (aucun arrondi)
              et le clipping RN ne s'applique de toute façon pas à la surface
              GL d'Android. */}
          <View className="mt-2 flex-1">
            <DealsMap deals={deals} category={category} />
          </View>
        </View>
      ) : (
        <FlatList
          data={deals}
          keyExtractor={(d) => d.id}
          renderItem={({ item }) => (
            <View className="px-5">
              <FlashCard deal={item} />
            </View>
          )}
          showsVerticalScrollIndicator={false}
          contentContainerClassName="pb-28"
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View className="pb-1">
              <View className="mx-5 mb-4 flex-row items-center gap-2 rounded-control border border-line bg-surface-muted px-3">
                <Feather name="search" size={18} color={colors.inkFaint} />
                <TextField
                  testID="home-search"
                  placeholder="Je sais ce que je veux…"
                  value={query}
                  onChangeText={setQuery}
                  returnKeyType="search"
                  className="border-0 bg-transparent px-0"
                />
              </View>

              {/* Ad card sits above the filter and stays visible whatever the
                selected category — it advertises the deal, it isn't a result. */}
              {featured ? <FeaturedBanner deal={featured} /> : null}

              <CategoryBar value={category} onChange={setCategory} />

              <View className="mb-3 mt-4 flex-row items-end justify-between px-5">
                <AppText variant="title" className="text-lg">
                  Ventes flash près de vous
                </AppText>
                <AppText variant="caption" className="text-ink-faint">
                  {deals.length} offres
                </AppText>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View className="items-center px-10 pt-16" testID="home-empty">
              <Feather name="search" size={30} color={colors.inkFaint} />
              <AppText variant="title" className="mt-3 text-center text-ink-faint">
                Aucune offre pour cette recherche
              </AppText>
              <AppText variant="caption" className="mt-1 text-center">
                Essayez une autre catégorie ou un autre mot-clé.
              </AppText>
            </View>
          }
        />
      )}
    </Screen>
  );
}
