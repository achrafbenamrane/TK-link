import { Feather } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { AppText, PushButton, Screen } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { DEALS, getMerchant } from '../model/catalog';
import { useShopStore } from '../model/store';
import { Countdown } from './components/countdown';
import { ProductImage } from './components/product-image';

type Props = {
  merchantId: string;
  /**
   * Solde de fidélité chez cette enseigne, injecté par la route : la boutique
   * ne connaît pas la feature « loyalty » (pas d'import entre features).
   */
  loyaltyPoints?: number;
  onOpenLoyalty: () => void;
  onOpenDeal: (dealId: string) => void;
  onBack: () => void;
};

/**
 * La fiche d'une enseigne — le carrefour de la maquette du client : ses ventes
 * flash, sa carte de fidélité, ses infos. C'est de là qu'on entre dans la
 * fidélité, et c'est ce qui manquait : `merchant-screen` est le formulaire
 * d'inscription des commerçants, pas leur vitrine.
 */
export function MerchantDetailScreen({
  merchantId,
  loyaltyPoints,
  onOpenLoyalty,
  onOpenDeal,
  onBack,
}: Props) {
  const merchant = getMerchant(merchantId);
  const addToCart = useShopStore((s) => s.addToCart);
  const favorites = useShopStore((s) => s.favorites);
  const toggleFavorite = useShopStore((s) => s.toggleFavorite);

  const deals = useMemo(() => DEALS.filter((d) => d.merchantId === merchantId), [merchantId]);
  const hero = deals[0];
  // Les favoris portent sur des OFFRES, pas sur des enseignes : le cœur agit
  // donc sur la vente flash en cours. Mettre un id d'enseigne dans cette liste
  // la corromprait silencieusement.
  const isFavorite = hero ? favorites.includes(hero.id) : false;

  if (!merchant) {
    return (
      <Screen testID="merchant-detail-missing">
        <View className="flex-1 items-center justify-center gap-3">
          <Feather name="help-circle" size={28} color={colors.inkFaint} />
          <AppText variant="title" className="text-base">
            Enseigne introuvable
          </AppText>
          <Pressable testID="merchant-detail-back" onPress={onBack} accessibilityRole="button">
            <AppText className="font-sans-bold text-brand-600">Retour</AppText>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen testID="merchant-detail-screen" padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-10">
        {/* Bandeau : retour, enseigne, favori */}
        <View className="flex-row items-center gap-3 px-5 pb-3 pt-2">
          <Pressable
            testID="merchant-back"
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={10}
            onPress={onBack}
            className="h-9 w-9 items-center justify-center rounded-pill bg-surface-muted"
          >
            <Feather name="chevron-left" size={22} color={colors.ink} />
          </Pressable>

          <View
            className="flex-1 flex-row items-center justify-center gap-2 rounded-pill px-4 py-2"
            style={{ borderWidth: 1.5, borderColor: colors.ink }}
          >
            <AppText style={{ fontSize: 16 }}>{merchant.emoji}</AppText>
            <AppText className="font-display text-ink" style={{ fontSize: 15 }} numberOfLines={1}>
              {merchant.name}
            </AppText>
          </View>

          {hero ? (
            <Pressable
              testID="merchant-favorite"
              accessibilityRole="button"
              accessibilityLabel={
                isFavorite ? 'Retirer cette offre des favoris' : 'Ajouter cette offre aux favoris'
              }
              hitSlop={10}
              onPress={() => toggleFavorite(hero.id)}
              className="h-9 w-9 items-center justify-center rounded-pill bg-surface-muted"
            >
              <Feather
                name="heart"
                size={18}
                color={isFavorite ? colors.brand500 : colors.inkMuted}
              />
            </Pressable>
          ) : (
            <View className="h-9 w-9" />
          )}
        </View>

        {/* La vente flash en cours */}
        {hero ? (
          <View className="mx-5 overflow-hidden rounded-card bg-ink">
            <View className="flex-row items-center justify-between px-4 pt-3">
              <View className="flex-row items-center gap-1.5 rounded-pill bg-ink-inverse/15 px-3 py-1">
                <Feather name="clock" size={12} color={colors.inkInverse} />
                <Countdown seconds={hero.endsInSeconds} className="text-ink-inverse" />
              </View>
              <View className="flex-row items-center gap-1.5 rounded-pill bg-brand-500 px-3 py-1">
                <Feather name="zap" size={12} color={colors.inkInverse} />
                <AppText
                  className="font-sans-bold text-ink-inverse"
                  style={{ fontSize: 12, fontVariant: ['tabular-nums'] }}
                >
                  Reste {hero.stockLeft}
                </AppText>
              </View>
            </View>

            <Pressable
              testID="merchant-hero-deal"
              accessibilityRole="button"
              accessibilityLabel={hero.title}
              onPress={() => onOpenDeal(hero.id)}
              className="mt-3 items-center px-4"
            >
              <View
                className="h-40 w-full items-center justify-center overflow-hidden rounded-card"
                style={{ backgroundColor: hero.tint }}
              >
                <ProductImage deal={hero} emojiSize={64} />
              </View>
            </Pressable>

            {/* Le bouton « FLASH PROMO GO » de la maquette */}
            <View className="items-center py-4">
              <PushButton
                testID="merchant-flash-go"
                accessibilityLabel="Voir la promo flash"
                label="FLASH PROMO"
                sublabel="GO"
                size={96}
                onPress={() => onOpenDeal(hero.id)}
              />
            </View>

            <View className="flex-row items-center justify-between bg-ink-inverse px-4 py-3">
              <View className="flex-1">
                <AppText className="font-sans-bold text-ink" numberOfLines={1}>
                  {hero.title}
                </AppText>
                <AppText variant="caption" numberOfLines={1}>
                  {hero.unit ?? hero.description}
                </AppText>
              </View>
              <View className="flex-row items-baseline gap-2">
                {hero.oldPrice ? (
                  <AppText
                    className="text-ink-faint line-through"
                    style={{ fontSize: 13, fontVariant: ['tabular-nums'] }}
                  >
                    {hero.oldPrice.toFixed(2)}€
                  </AppText>
                ) : null}
                <AppText
                  className="font-display text-brand-600"
                  style={{ fontSize: 20, fontVariant: ['tabular-nums'] }}
                >
                  {hero.price.toFixed(2)}€
                </AppText>
              </View>
            </View>
          </View>
        ) : null}

        {/* Les trois cartes : Fidélité · la Carte · Infos */}
        <View className="mt-4 flex-row gap-3 px-5">
          <Pressable
            testID="merchant-loyalty-card"
            accessibilityRole="button"
            accessibilityLabel="Voir ma fidélité"
            onPress={onOpenLoyalty}
            className="flex-1 gap-1.5 rounded-card bg-surface p-3.5 active:opacity-80"
            style={{ borderWidth: 1.5, borderColor: colors.brand500 }}
          >
            <View className="flex-row items-center gap-1.5">
              <Feather name="award" size={15} color={colors.brand600} />
              <AppText className="font-sans-bold text-ink" style={{ fontSize: 13 }}>
                Fidélité
              </AppText>
            </View>
            <AppText
              className="font-display text-brand-600"
              style={{ fontSize: 19, fontVariant: ['tabular-nums'] }}
            >
              {loyaltyPoints ?? 0}
            </AppText>
            <AppText variant="caption" className="text-ink-faint" style={{ fontSize: 11 }}>
              points cumulés
            </AppText>
          </Pressable>

          <Pressable
            testID="merchant-menu-card"
            accessibilityRole="button"
            accessibilityLabel="Voir la carte"
            onPress={() => hero && onOpenDeal(hero.id)}
            className="flex-1 gap-1.5 rounded-card bg-surface p-3.5 active:opacity-80"
            style={{ borderWidth: 1, borderColor: colors.line }}
          >
            <Feather name="book-open" size={15} color={colors.ink} />
            <AppText className="font-sans-bold text-ink" style={{ fontSize: 13 }}>
              La carte
            </AppText>
            <AppText variant="caption" className="text-ink-faint" style={{ fontSize: 11 }}>
              {deals.length} offre{deals.length > 1 ? 's' : ''}
            </AppText>
          </Pressable>

          <View
            className="flex-1 gap-1.5 rounded-card bg-surface p-3.5"
            style={{ borderWidth: 1, borderColor: colors.line }}
          >
            <Feather name="map-pin" size={15} color={colors.ink} />
            <AppText className="font-sans-bold text-ink" style={{ fontSize: 13 }}>
              Infos
            </AppText>
            <AppText variant="caption" className="text-ink-faint" style={{ fontSize: 11 }}>
              {merchant.area} · ★ {merchant.rating}
            </AppText>
          </View>
        </View>

        {/* Les autres offres de l'enseigne */}
        {deals.length > 1 ? (
          <View className="mt-6 gap-2.5 px-5">
            <AppText className="font-sans-semibold text-ink">Aussi chez {merchant.name}</AppText>
            {deals.slice(1).map((d) => (
              <Pressable
                key={d.id}
                testID={`merchant-deal-${d.id}`}
                accessibilityRole="button"
                accessibilityLabel={d.title}
                onPress={() => onOpenDeal(d.id)}
                className="flex-row items-center gap-3 rounded-card bg-surface p-3 active:opacity-80"
                style={{ borderWidth: 1, borderColor: colors.line }}
              >
                <View
                  className="h-14 w-14 items-center justify-center overflow-hidden rounded-control"
                  style={{ backgroundColor: d.tint }}
                >
                  <ProductImage deal={d} emojiSize={28} />
                </View>
                <View className="flex-1">
                  <AppText className="font-sans-semibold text-ink" numberOfLines={1}>
                    {d.title}
                  </AppText>
                  <AppText variant="caption" numberOfLines={1}>
                    Reste {d.stockLeft} · {d.rating} ★
                  </AppText>
                </View>
                <AppText
                  className="font-sans-bold text-brand-600"
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  {d.price.toFixed(2)}€
                </AppText>
                <Pressable
                  testID={`merchant-add-${d.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Ajouter ${d.title} au panier`}
                  hitSlop={8}
                  onPress={() => addToCart(d.id)}
                  className="h-8 w-8 items-center justify-center rounded-pill bg-brand-500 active:bg-brand-600"
                >
                  <Feather name="plus" size={16} color={colors.inkInverse} />
                </Pressable>
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
