import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText, PushButton } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { getMerchant } from '../../model/catalog';
import { distanceKm, formatDistance } from '../../lib/geo';
import { discountPct, liquidationLabel, urgencyOf } from '../../lib/urgency';
import type { Deal } from '../../model/schema';
import { useShopStore } from '../../model/store';
import { Countdown } from './countdown';
import { ProductImage } from './product-image';

type Props = { deal: Deal };

/**
 * Hauteur du visuel, en pixels et NON en classe utilitaire.
 *
 * Une classe de hauteur inédite (`h-52`) a été silencieusement ignorée par la
 * feuille NativeWind déjà compilée sur l'appareil : le bloc image est tombé à
 * zéro, le compte à rebours a chevauché le nom du commerçant, et le badge de
 * remise s'est fait rogner. Une classe manquante ne casse rien bruyamment —
 * elle vaut simplement « rien ».
 *
 * La photo est l'élément le plus important de la carte : sa hauteur ne dépend
 * donc pas d'un cache de styles. Elle voyage avec la teinte, déjà dynamique.
 */
const IMAGE_HEIGHT = 230;

/**
 * LA CARTE D'UNE VENTE FLASH — le cœur de l'app, et donc l'écran qu'on
 * retravaille en dernier recours plutôt qu'à la légère.
 *
 * Quatre informations doivent se lire AVANT tout le reste, dans cet ordre :
 * le produit (la photo), ce qu'il coûte maintenant contre son prix normal,
 * combien de temps il reste, et combien il en reste. C'est la demande du
 * client — « il faut que ça se voie du premier coup d'œil » — et c'est aussi
 * ce qui distingue un déstockage d'un catalogue de promotions.
 *
 * La hiérarchie est donc TYPOGRAPHIQUE et pas décorative : le prix flash est
 * le plus gros élément de la carte après la photo, le compte à rebours vire au
 * rouge quand l'offre agonise, et le stock restant est une pastille sur
 * l'image — pas une ligne de légende qu'on lit en dernier.
 */
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

  const discount = discountPct(deal);
  const urgency = urgencyOf(deal);
  const critical = urgency === 'critique';
  const stockPct = deal.stockTotal > 0 ? (deal.stockLeft / deal.stockTotal) * 100 : 0;
  const low = deal.stockLeft <= deal.stockTotal * 0.25;

  return (
    <Pressable
      testID={`deal-${deal.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${deal.title}, ${deal.price.toFixed(2)} euros au lieu de ${(
        deal.oldPrice ?? deal.price
      ).toFixed(2)}, ${deal.stockLeft} restant${deal.stockLeft > 1 ? 's' : ''}`}
      onPress={() => router.push(`/produit/${deal.id}`)}
      className="mb-4 overflow-hidden rounded-card border border-line bg-surface"
    >
      {/* ------------------------------------------------------------ visuel */}
      <View
        className="items-center justify-center"
        style={{ height: IMAGE_HEIGHT, backgroundColor: deal.tint }}
      >
        <ProductImage deal={deal} emojiSize={96} />

        {/* Le temps qui reste — rouge dès que l'offre agonise. */}
        <View
          testID={`deal-${deal.id}-countdown`}
          className="absolute left-3 top-3 flex-row items-center gap-1.5 rounded-pill px-3 py-1.5"
          style={{ backgroundColor: critical ? colors.danger : colors.ink }}
        >
          <Feather name="clock" size={13} color={colors.inkInverse} />
          <Countdown seconds={deal.endsInSeconds} className="text-sm text-ink-inverse" />
        </View>

        <Pressable
          testID={`fav-${deal.id}`}
          hitSlop={8}
          accessibilityLabel="Ajouter aux favoris"
          onPress={() => toggleFavorite(deal.id)}
          className="absolute right-3 top-3 h-10 w-10 items-center justify-center rounded-pill bg-surface/90"
        >
          <Ionicons
            name={isFav ? 'heart' : 'heart-outline'}
            size={20}
            color={isFav ? colors.brand500 : colors.inkMuted}
          />
        </Pressable>

        {/* La remise, en gros : c'est elle qui fait s'arrêter le pouce. */}
        {discount ? (
          <View className="absolute bottom-3 left-3 rounded-control bg-brand-500 px-3 py-1.5">
            <AppText className="font-display text-ink-inverse" style={{ fontSize: 19 }}>
              -{discount}%
            </AppText>
          </View>
        ) : null}

        {/* Ce qu'il reste, sur l'image et non en légende. */}
        <View
          testID={`deal-${deal.id}-stock`}
          className="absolute bottom-3 right-3 flex-row items-center gap-1.5 rounded-pill px-3 py-1.5"
          style={{ backgroundColor: low ? colors.danger : 'rgba(15,26,18,0.82)' }}
        >
          <Feather name="package" size={12} color={colors.inkInverse} />
          <AppText className="font-sans-bold text-ink-inverse" style={{ fontSize: 12.5 }}>
            {deal.stockLeft > 0
              ? `${deal.stockLeft} restant${deal.stockLeft > 1 ? 's' : ''}`
              : 'Épuisé'}
          </AppText>
        </View>
      </View>

      {/* ------------------------------------------------------------ contenu */}
      <View className="gap-2 p-4">
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
            <View className="flex-row items-center gap-0.5">
              <Ionicons name="star" size={11} color={colors.brand500} />
              <AppText variant="caption" className="font-sans-semibold text-ink">
                {deal.rating.toFixed(1)}
              </AppText>
            </View>
          </View>
          <View className="flex-row items-center gap-1">
            <Feather name={distance ? 'navigation' : 'map-pin'} size={12} color={colors.inkFaint} />
            <AppText variant="caption" className="text-ink-faint">
              {/* Position refusée ou indisponible → on affiche le quartier :
                  toujours quelque chose de vrai, jamais une distance inventée. */}
              {distance ? formatDistance(distance) : (merchant?.area ?? '')}
            </AppText>
          </View>
        </View>

        <AppText variant="title" className="text-lg leading-snug" numberOfLines={1}>
          {deal.title}
        </AppText>
        {deal.unit ? (
          <AppText variant="caption" className="-mt-1.5 text-ink-faint">
            {deal.unit}
          </AppText>
        ) : null}

        {/* Le prix domine tout le bas de la carte. */}
        <View className="mt-1 flex-row items-end">
          <View className="flex-1 flex-row items-baseline gap-2">
            <AppText
              testID={`deal-${deal.id}-price`}
              className="font-display text-ink"
              style={{ fontSize: 34, lineHeight: 43 }}
            >
              {deal.price.toFixed(2)}€
            </AppText>
            {deal.oldPrice ? (
              <AppText
                className="text-ink-faint line-through"
                style={{ fontSize: 17, lineHeight: 23 }}
              >
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
        </View>

        {/* La jauge redit le stock — l'œil la lit sans lire les chiffres. */}
        <View className="mt-0.5 gap-1">
          <View className="h-2 overflow-hidden rounded-pill bg-surface-sunken">
            <View
              className="h-full rounded-pill"
              style={{
                width: `${Math.max(6, Math.round(stockPct))}%`,
                backgroundColor: low ? colors.danger : colors.ink,
              }}
            />
          </View>
          <AppText
            variant="caption"
            className={cn('text-xs', critical ? 'font-sans-bold text-danger' : 'text-ink-faint')}
          >
            {critical
              ? liquidationLabel(deal).toUpperCase()
              : `Reste ${deal.stockLeft} sur ${deal.stockTotal}`}
          </AppText>
        </View>
      </View>
    </Pressable>
  );
}
