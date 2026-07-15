import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText, PushButton } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { getMerchant } from '../../model/catalog';
import { distanceKm, formatDistance } from '../../lib/geo';
import type { Deal } from '../../model/schema';
import { useShopStore } from '../../model/store';
import { Countdown } from './countdown';
import { ProductImage } from './product-image';

type Props = { deal: Deal };

export function FlashCard({ deal }: Props) {
  const router = useRouter();
  const merchant = getMerchant(deal.merchantId);
  const addToCart = useShopStore((s) => s.addToCart);
  const toggleFavorite = useShopStore((s) => s.toggleFavorite);
  const isFav = useShopStore((s) => s.favorites.includes(deal.id));
  // Une seule position pour toute la liste — la demande vit dans HomeScreen,
  // pas ici : 10 cartes = 10 demandes de permission.
  const userCoord = useShopStore((s) => s.userCoord);
  const distance = userCoord && merchant ? distanceKm(userCoord, merchant.coord) : null;

  const discount = deal.oldPrice ? Math.round((1 - deal.price / deal.oldPrice) * 100) : null;
  const stockPct = Math.round((deal.stockLeft / deal.stockTotal) * 100);
  const low = deal.stockLeft <= deal.stockTotal * 0.25;

  return (
    <Pressable
      testID={`deal-${deal.id}`}
      accessibilityRole="button"
      onPress={() => router.push(`/produit/${deal.id}`)}
      className="mb-4 overflow-hidden rounded-card border border-line bg-surface"
    >
      <View className="h-44 items-center justify-center" style={{ backgroundColor: deal.tint }}>
        <ProductImage deal={deal} emojiSize={72} />

        <View className="absolute left-3 top-3 flex-row items-center gap-1.5 rounded-control bg-ink px-2.5 py-1.5">
          <Feather name="clock" size={12} color={colors.inkInverse} />
          <Countdown seconds={deal.endsInSeconds} className="text-xs text-ink-inverse" />
        </View>

        <Pressable
          testID={`fav-${deal.id}`}
          hitSlop={8}
          accessibilityLabel="Ajouter aux favoris"
          onPress={() => toggleFavorite(deal.id)}
          className="absolute right-3 top-3 h-9 w-9 items-center justify-center rounded-pill bg-surface/90"
        >
          <Ionicons
            name={isFav ? 'heart' : 'heart-outline'}
            size={18}
            color={isFav ? colors.brand500 : colors.inkMuted}
          />
        </Pressable>

        {discount ? (
          <View className="absolute bottom-3 left-3 rounded-control bg-brand-500 px-2.5 py-1">
            <AppText className="font-sans-bold text-xs text-ink-inverse">-{discount}%</AppText>
          </View>
        ) : null}
      </View>

      <View className="gap-2 p-3.5">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 flex-row items-center gap-1.5 pr-2">
            <AppText style={{ fontSize: 14 }}>{merchant?.emoji}</AppText>
            <AppText
              variant="caption"
              className="font-sans-medium text-ink-muted"
              numberOfLines={1}
            >
              {merchant?.name}
            </AppText>
          </View>
          <View className="flex-row items-center gap-1">
            <Ionicons name="star" size={12} color={colors.brand500} />
            <AppText variant="caption" className="font-sans-semibold text-ink">
              {deal.rating.toFixed(1)}
            </AppText>
          </View>
        </View>

        <AppText variant="title" className="text-base leading-snug" numberOfLines={1}>
          {deal.title}
        </AppText>
        {deal.unit ? (
          <AppText variant="caption" className="-mt-1 text-ink-faint">
            {deal.unit}
          </AppText>
        ) : null}

        <View className="mt-0.5 gap-1">
          <View className="h-1.5 overflow-hidden rounded-pill bg-surface-sunken">
            <View
              className={cn('h-full rounded-pill', low ? 'bg-brand-500' : 'bg-ink')}
              style={{ width: `${Math.max(8, stockPct)}%` }}
            />
          </View>
          <AppText
            variant="caption"
            className={cn('text-xs', low ? 'font-sans-semibold text-brand-600' : 'text-ink-faint')}
          >
            {low
              ? `Plus que ${deal.stockLeft} !`
              : `Reste ${deal.stockLeft} sur ${deal.stockTotal}`}
          </AppText>
        </View>

        {/* Prix à gauche, bouton signature au centre (marquage client), distance
            à droite pour équilibrer la ligne avec une info utile. */}
        <View className="mt-1 flex-row items-center">
          <View className="flex-1">
            <AppText className="font-display text-xl text-ink">{deal.price.toFixed(2)}€</AppText>
            {deal.oldPrice ? (
              <AppText variant="caption" className="text-ink-faint line-through">
                {deal.oldPrice.toFixed(2)}€
              </AppText>
            ) : null}
          </View>

          <PushButton
            testID={`add-${deal.id}`}
            onPress={() => addToCart(deal.id)}
            icon="plus"
            sublabel="AJOUTER"
            size={62}
            accessibilityLabel={`Ajouter ${deal.title} au panier`}
          />

          <View className="flex-1 items-end">
            <Feather name={distance ? 'navigation' : 'map-pin'} size={13} color={colors.inkFaint} />
            <AppText
              variant="caption"
              className="mt-0.5 text-right text-ink-faint"
              numberOfLines={1}
            >
              {/* Position refusée ou indisponible → on affiche le quartier :
                  toujours quelque chose de vrai, jamais une distance inventée. */}
              {distance ? formatDistance(distance) : (merchant?.area ?? '')}
            </AppText>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
