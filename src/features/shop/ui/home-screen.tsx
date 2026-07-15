import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { AppText, Screen, TextField } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { dealsByCategory, getDeal, getMerchant, FEATURED_DEAL_ID } from '../model/catalog';
import type { Category, Deal } from '../model/schema';
import { selectCartCount, useShopStore } from '../model/store';
import { CategoryBar } from './components/category-bar';
import { Countdown } from './components/countdown';
import { FlashCard } from './components/flash-card';

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
          <AppText style={{ fontSize: 42, lineHeight: 50 }}>{deal.emoji}</AppText>
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

export function HomeScreen() {
  const [category, setCategory] = useState<Category | null>(null);
  const [query, setQuery] = useState('');

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
    return list;
  }, [category, query]);

  const showFeatured = category === null && query.trim() === '';
  const featured = getDeal(FEATURED_DEAL_ID);

  return (
    <Screen padded={false} testID="home-screen">
      <View className="flex-row items-center justify-between px-5 pb-3 pt-2">
        <View>
          <AppText className="font-display text-ink" style={{ fontSize: 20 }}>
            Freedoo<AppText className="text-brand-500">.</AppText>
          </AppText>
          <View className="mt-0.5 flex-row items-center gap-1">
            <Feather name="map-pin" size={12} color={colors.inkFaint} />
            <AppText variant="caption" className="text-ink-faint">
              Toulouse · Centre
            </AppText>
          </View>
        </View>
        <CartButton />
      </View>

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

            <CategoryBar value={category} onChange={setCategory} />

            {showFeatured && featured ? (
              <View className="mt-4">
                <FeaturedBanner deal={featured} />
              </View>
            ) : (
              <View className="h-4" />
            )}

            <View className="mb-3 flex-row items-end justify-between px-5">
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
    </Screen>
  );
}
