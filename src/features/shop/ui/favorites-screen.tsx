import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { AppText, Button, EmptyState, Screen } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { getDeal } from '../model/catalog';
import type { Deal } from '../model/schema';
import { selectFavorites, useShopStore } from '../model/store';
import { CartButton } from './components/cart-button';
import { Countdown } from './components/countdown';
import { ProductImage } from './components/product-image';

/**
 * Une carte compacte : deux par ligne.
 *
 * Les favoris se consultent en balayant — on cherche « lequel je prends ? »,
 * pas le détail de chacun. D'où la grille : deux fois plus d'offres à l'écran,
 * et le prix + l'ajout au panier accessibles sans ouvrir la fiche.
 */
function FavoriteCard({ deal }: { deal: Deal }) {
  const router = useRouter();
  const addToCart = useShopStore((s) => s.addToCart);
  const toggleFavorite = useShopStore((s) => s.toggleFavorite);
  const low = deal.stockLeft <= deal.stockTotal * 0.25;

  return (
    <Pressable
      testID={`favorite-card-${deal.id}`}
      accessibilityRole="button"
      accessibilityLabel={deal.title}
      onPress={() => router.push({ pathname: '/produit/[id]', params: { id: deal.id } })}
      className="flex-1 overflow-hidden rounded-card bg-surface active:opacity-80"
      style={{ borderWidth: 1, borderColor: colors.line }}
    >
      {/* Visuel + incrustations */}
      <View
        className="aspect-square items-center justify-center"
        style={{ backgroundColor: deal.tint }}
      >
        <ProductImage deal={deal} emojiSize={54} />

        <View className="absolute left-1.5 top-1.5 flex-row items-center gap-1 rounded-pill bg-ink px-2 py-1">
          <Feather name="clock" size={9} color={colors.inkInverse} />
          <Countdown seconds={deal.endsInSeconds} className="text-ink-inverse" />
        </View>

        <Pressable
          testID={`favorite-remove-${deal.id}`}
          accessibilityRole="button"
          accessibilityLabel={`Retirer ${deal.title} des favoris`}
          hitSlop={8}
          onPress={() => toggleFavorite(deal.id)}
          className="absolute right-1.5 top-1.5 h-7 w-7 items-center justify-center rounded-pill bg-surface/90"
        >
          <Feather name="heart" size={14} color={colors.brand500} />
        </Pressable>

        {low ? (
          <View className="absolute bottom-1.5 left-1.5 rounded-pill bg-brand-500 px-2 py-0.5">
            <AppText className="font-sans-bold text-ink-inverse" style={{ fontSize: 9 }}>
              Plus que {deal.stockLeft}
            </AppText>
          </View>
        ) : null}
      </View>

      {/* Texte + prix */}
      <View className="gap-1 p-2.5">
        <AppText className="font-sans-semibold text-ink" style={{ fontSize: 13 }} numberOfLines={2}>
          {deal.title}
        </AppText>

        <View className="flex-row items-end justify-between">
          <View className="flex-1">
            <View className="flex-row items-baseline gap-1.5">
              <AppText
                className="font-display text-ink"
                style={{ fontSize: 16, fontVariant: ['tabular-nums'] }}
              >
                {deal.price.toFixed(2)}€
              </AppText>
              {deal.oldPrice ? (
                <AppText
                  className="text-ink-faint line-through"
                  style={{ fontSize: 11, fontVariant: ['tabular-nums'] }}
                >
                  {deal.oldPrice.toFixed(2)}€
                </AppText>
              ) : null}
            </View>
          </View>

          <Pressable
            testID={`favorite-add-${deal.id}`}
            accessibilityRole="button"
            accessibilityLabel={`Ajouter ${deal.title} au panier`}
            hitSlop={8}
            onPress={() => addToCart(deal.id)}
            className="h-8 w-8 items-center justify-center rounded-pill bg-brand-500 active:bg-brand-600"
          >
            <Feather name="plus" size={16} color={colors.inkInverse} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

export function FavoritesScreen() {
  const router = useRouter();
  const favIds = useShopStore(selectFavorites);
  const deals = useMemo(() => favIds.map(getDeal).filter((d): d is Deal => Boolean(d)), [favIds]);
  // Nombre impair → on complète d'un bouche-trou pour la dernière ligne.
  const rows = useMemo<(Deal | null)[]>(
    () => (deals.length % 2 === 1 ? [...deals, null] : deals),
    [deals],
  );

  return (
    <Screen padded={false} testID="favorites-screen">
      <View className="flex-row items-start justify-between px-5 pb-3 pt-2">
        <View className="flex-1 pr-3">
          <AppText variant="display">Favoris</AppText>
          <AppText variant="caption">Vos coups de cœur, à saisir avant qu’ils s’envolent</AppText>
        </View>
        <CartButton testID="favorites-cart" />
      </View>

      <FlatList
        data={rows}
        keyExtractor={(d, i) => d?.id ?? `hole-${i}`}
        numColumns={2}
        renderItem={({ item }) =>
          // Le bouche-trou garde la dernière carte à sa demi-largeur quand le
          // nombre de favoris est impair : sans lui, `flex-1` l'étire sur toute
          // la ligne.
          item ? <FavoriteCard deal={item} /> : <View className="flex-1" />
        }
        // Style explicite : `columnWrapperClassName` n'est pas garanti côté
        // NativeWind, et un no-op silencieux collerait les deux colonnes.
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 20 }}
        contentContainerClassName="gap-3 pb-28 pt-1"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            testID="favorites-empty"
            title="Aucun favori pour l’instant"
            description="Touchez le cœur d’une offre pour la retrouver ici."
            icon={<Feather name="heart" size={30} color={colors.inkFaint} />}
            action={<Button label="Parcourir les offres" onPress={() => router.replace('/')} />}
          />
        }
      />
    </Screen>
  );
}
