import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, Share, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText, Screen, ThemeToggle } from '@/shared/ui';
import { ShopVideo } from '@/shared/ui/shop-video';
import { useColors } from '@/shared/theme/theme-provider';

import { FULFILMENT_LABEL, FULFILMENTS } from '../lib/order-status';
import { videoSource } from '../lib/showcase';
import { DEALS, getMerchant } from '../model/catalog';
import { productImageUri } from '../model/product-images';
import type { Deal } from '../model/schema';
import { useShopStore } from '../model/store';
import { Countdown } from './components/countdown';
import { ProductImage } from './components/product-image';

type Props = {
  merchantId: string;
  /**
   * La vitrine réglée par le commerçant (présentation, photos, vidéos, horaires) —
   * fournie par la route : la boutique ne connaît pas l'espace commerçant. Absente
   * pour les enseignes du catalogue qui n'ont rien renseigné : aucune vidéo ni
   * photo n'est inventée.
   */
  profile?: {
    presentation: string;
    photos: string[];
    videos?: string[];
    status: string;
    zone?: string;
  };
  /**
   * Fidélité chez cette enseigne, injectée par la route (la boutique ne connaît pas la
   * feature « loyalty ») : le solde, ce qu'il reste avant le prochain palier, et la
   * progression de 0 à 1.
   */
  loyalty?: { points: number; remaining: number | null; progress: number };
  /** Téléphone du commerce, s'il est connu. Sans lui, « Appeler » est grisé. */
  phone?: string;
  onOpenLoyalty: () => void;
  onOpenDeal: (dealId: string) => void;
  onBack: () => void;
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

/** Une carte « Flash du moment » — deux par ligne, comme la maquette du client. */
function FlashTile({ deal, onOpen, onAdd }: { deal: Deal; onOpen: () => void; onAdd: () => void }) {
  const colors = useColors();
  const modes = deal.fulfilments ?? [...FULFILMENTS];
  return (
    <Pressable
      testID={`merchant-deal-${deal.id}`}
      accessibilityRole="button"
      accessibilityLabel={deal.title}
      onPress={onOpen}
      className="flex-1 gap-1.5 rounded-card border border-brand-500 bg-surface-muted p-3 active:opacity-80"
    >
      <View className="flex-row items-center gap-1 self-start rounded-pill border border-brand-500 px-2 py-0.5">
        <Feather name="clock" size={10} color={colors.brand500} />
        <Countdown seconds={deal.endsInSeconds} className="text-ink" />
      </View>
      <AppText className="font-sans-bold text-ink" style={{ fontSize: 13 }} numberOfLines={1}>
        {deal.title}
      </AppText>
      <AppText
        variant="caption"
        className="text-ink-faint"
        style={{ fontSize: 11 }}
        numberOfLines={1}
      >
        {deal.unit ?? deal.description}
      </AppText>
      <View
        className="h-20 w-full items-center justify-center overflow-hidden rounded-control"
        style={{ backgroundColor: deal.tint }}
      >
        <ProductImage deal={deal} emojiSize={36} />
      </View>
      <View className="flex-row items-baseline gap-1.5">
        <AppText className="font-sans-bold text-brand-500" style={{ fontSize: 14 }}>
          {deal.price.toFixed(2).replace('.', ',')} €
        </AppText>
        {deal.oldPrice ? (
          <AppText className="text-ink-faint line-through" style={{ fontSize: 11 }}>
            {deal.oldPrice.toFixed(2).replace('.', ',')} €
          </AppText>
        ) : null}
      </View>
      <View className="flex-row items-center justify-between">
        <View className="rounded-control border border-warning px-2 py-0.5">
          <AppText className="font-sans-semibold text-warning" style={{ fontSize: 10.5 }}>
            Stock : {deal.stockLeft}
          </AppText>
        </View>
        <Pressable
          testID={`merchant-add-${deal.id}`}
          accessibilityRole="button"
          accessibilityLabel={`Ajouter ${deal.title} au panier`}
          hitSlop={8}
          onPress={onAdd}
          className="h-7 w-7 items-center justify-center rounded-pill bg-brand-500 active:bg-brand-600"
        >
          <Feather name="plus" size={16} color="#FFFFFF" />
        </Pressable>
      </View>
      <View className="flex-row items-center justify-between border-t border-line pt-1.5">
        {modes.map((m) => (
          <View key={m} className="flex-row items-center gap-1">
            <Feather
              name={m === 'livraison' ? 'truck' : 'shopping-bag'}
              size={10}
              color={colors.brand500}
            />
            <AppText className="text-ink-muted" style={{ fontSize: 9.5 }}>
              {FULFILMENT_LABEL[m]}
            </AppText>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

/**
 * LA VITRINE D'UNE ENSEIGNE — telle que le client l'a dessinée : identité
 * (logo, note, quartier, ouvert/fermé), quatre raccourcis, vidéo du magasin,
 * portfolio photos, « Nos Flash du moment » et la barre de fidélité.
 *
 * Tout ce que le commerçant n'a pas renseigné est omis : pas de vidéo ni de
 * téléphone inventés.
 */
export function MerchantDetailScreen({
  merchantId,
  profile,
  loyalty,
  phone,
  onOpenLoyalty,
  onOpenDeal,
  onBack,
}: Props) {
  const colors = useColors();
  const merchant = getMerchant(merchantId);
  const addToCart = useShopStore((s) => s.addToCart);
  const favorites = useShopStore((s) => s.favorites);
  const toggleFavorite = useShopStore((s) => s.toggleFavorite);
  const [showInfos, setShowInfos] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const deals = useMemo(() => DEALS.filter((d) => d.merchantId === merchantId), [merchantId]);
  const hero = deals[0];
  // Les favoris portent sur des OFFRES, pas sur des enseignes.
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

  const open = profile?.status.startsWith('Ouvert')
    ? 'open'
    : profile?.status === 'Fermé'
      ? 'closed'
      : null;
  const shownDeals = showAll ? deals : deals.slice(0, 2);
  const video = profile?.videos?.[0];

  const actions: {
    key: string;
    icon: 'gift' | 'info' | 'phone' | 'share-2';
    label: string;
    disabled?: boolean;
    onPress: () => void;
  }[] = [
    { key: 'loyalty', icon: 'gift', label: 'Fidélité', onPress: onOpenLoyalty },
    { key: 'infos', icon: 'info', label: 'Infos', onPress: () => setShowInfos((v) => !v) },
    {
      key: 'call',
      icon: 'phone',
      label: 'Appeler',
      disabled: !phone,
      onPress: () => phone && void Linking.openURL(`tel:${phone.replace(/\s/g, '')}`),
    },
    {
      key: 'share',
      icon: 'share-2',
      label: 'Partager',
      onPress: () =>
        void Share.share({
          message: `${merchant.name} sur TK LINK — ventes flash près de chez vous`,
        }).catch(() => undefined),
    },
  ];

  return (
    <Screen testID="merchant-detail-screen" padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-4 px-5 pb-10">
        {/* Retour · favori · Nuit/Jour */}
        <View className="flex-row items-center gap-3 pt-2">
          <Pressable
            testID="merchant-back"
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={10}
            onPress={onBack}
          >
            <Feather name="arrow-left" size={24} color={colors.ink} />
          </Pressable>
          <View className="flex-1" />
          {hero ? (
            <Pressable
              testID="merchant-favorite"
              accessibilityRole="button"
              accessibilityLabel={
                isFavorite ? 'Retirer cette offre des favoris' : 'Ajouter cette offre aux favoris'
              }
              hitSlop={10}
              onPress={() => toggleFavorite(hero.id)}
            >
              <Feather
                name="heart"
                size={20}
                color={isFavorite ? colors.brand500 : colors.inkMuted}
              />
            </Pressable>
          ) : null}
          <ThemeToggle />
        </View>

        {/* Identité */}
        <View className="flex-row items-center gap-3.5">
          <View className="h-16 w-16 items-center justify-center rounded-pill border-2 border-brand-500 bg-surface-muted">
            <AppText className="font-display text-brand-500" style={{ fontSize: 22 }}>
              {initials(merchant.name)}
            </AppText>
          </View>
          <View className="flex-1 gap-1">
            <AppText className="font-display text-ink" style={{ fontSize: 22 }} numberOfLines={1}>
              {merchant.name}
            </AppText>
            <View className="flex-row items-center gap-3">
              <View className="flex-row items-center gap-1">
                <Feather name="star" size={13} color={colors.warning} />
                <AppText className="font-sans-semibold text-ink" style={{ fontSize: 13 }}>
                  {merchant.rating}
                </AppText>
              </View>
              <View className="flex-1 flex-row items-center gap-1">
                <Feather name="map-pin" size={13} color={colors.accent} />
                <AppText variant="caption" className="flex-1 text-ink-muted" numberOfLines={1}>
                  {merchant.area}
                </AppText>
              </View>
            </View>
          </View>
          {open ? (
            <View
              testID="merchant-open-badge"
              className={cn(
                'rounded-control border px-2.5 py-1',
                open === 'open' ? 'border-success' : 'border-danger',
              )}
            >
              <AppText
                className={cn('font-sans-bold', open === 'open' ? 'text-success' : 'text-danger')}
                style={{ fontSize: 11 }}
              >
                {open === 'open' ? 'OUVERT' : 'FERMÉ'}
              </AppText>
            </View>
          ) : null}
        </View>

        {/* Quatre raccourcis */}
        <View className="flex-row gap-2.5">
          {actions.map((a) => (
            <Pressable
              key={a.key}
              testID={a.key === 'loyalty' ? 'merchant-loyalty-card' : `merchant-action-${a.key}`}
              accessibilityRole="button"
              accessibilityLabel={a.label}
              accessibilityState={{ disabled: !!a.disabled }}
              disabled={a.disabled}
              onPress={a.onPress}
              className={cn(
                'flex-1 items-center gap-1.5 rounded-control border border-line bg-surface-muted py-3 active:opacity-80',
                a.disabled && 'opacity-40',
              )}
            >
              <Feather name={a.icon} size={19} color={colors.brand500} />
              <AppText className="text-ink" style={{ fontSize: 12 }}>
                {a.label}
              </AppText>
            </Pressable>
          ))}
        </View>

        {showInfos ? (
          <View
            testID="merchant-infos"
            className="gap-2 rounded-card border border-line bg-surface-muted p-4"
          >
            {profile?.presentation ? (
              <AppText className="text-ink-muted" style={{ fontSize: 13.5 }}>
                {profile.presentation}
              </AppText>
            ) : null}
            <View className="flex-row items-center gap-1.5">
              <Feather name="clock" size={13} color={colors.inkFaint} />
              <AppText testID="merchant-open-status" variant="caption" className="text-ink-muted">
                {profile?.status ?? 'Horaires non renseignés'}
              </AppText>
            </View>
            {profile?.zone ? (
              <View className="flex-row items-center gap-1.5">
                <Feather name="map-pin" size={13} color={colors.inkFaint} />
                <AppText variant="caption" className="text-ink-muted">
                  {profile.zone}
                </AppText>
              </View>
            ) : null}
            <AppText variant="caption" className="text-ink-faint">
              {merchant.area} · note {merchant.rating}
            </AppText>
          </View>
        ) : null}

        {/* Vidéo du magasin — seulement si le commerçant en a déposé une */}
        {video ? (
          <View className="gap-2">
            <AppText className="font-sans-bold text-ink">Vidéo du magasin</AppText>
            <ShopVideo
              testID="merchant-video"
              source={videoSource(video)}
              poster={
                profile?.photos[0] ??
                (deals[0] ? productImageUri(deals[0].id) || undefined : undefined)
              }
            />
          </View>
        ) : null}

        {/* Portfolio photos : celles du commerçant, puis les visuels de ses offres */}
        {(profile?.photos.length ?? 0) + deals.length > 0 ? (
          <View className="gap-2">
            <AppText className="font-sans-bold text-ink">Portfolio photos</AppText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-2"
            >
              {(profile?.photos ?? []).map((uri) => (
                <Image
                  key={uri}
                  source={{ uri }}
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.brand500,
                  }}
                  contentFit="cover"
                />
              ))}
              {deals.map((d) => (
                <View
                  key={d.id}
                  className="h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-control border border-brand-500"
                  style={{ backgroundColor: d.tint }}
                >
                  <ProductImage deal={d} emojiSize={30} />
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Nos Flash du moment */}
        {deals.length > 0 ? (
          <View className="gap-2.5">
            <View className="flex-row items-center justify-between">
              <AppText className="font-sans-bold text-ink">Nos Flash du moment</AppText>
              {deals.length > 2 ? (
                <Pressable
                  testID="merchant-see-all"
                  accessibilityRole="button"
                  onPress={() => setShowAll((v) => !v)}
                >
                  <AppText className="font-sans-semibold text-brand-500" style={{ fontSize: 13 }}>
                    {showAll ? 'Voir moins' : 'Voir tout'}
                  </AppText>
                </Pressable>
              ) : null}
            </View>
            {Array.from({ length: Math.ceil(shownDeals.length / 2) }, (_, row) => (
              <View key={row} className="flex-row gap-2.5">
                {shownDeals.slice(row * 2, row * 2 + 2).map((d) => (
                  <FlashTile
                    key={d.id}
                    deal={d}
                    onOpen={() => onOpenDeal(d.id)}
                    onAdd={() => addToCart(d.id)}
                  />
                ))}
                {shownDeals.slice(row * 2, row * 2 + 2).length === 1 ? (
                  <View className="flex-1" />
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <View testID="merchant-no-deals" className="items-center gap-1 py-6">
            <Feather name="zap" size={22} color={colors.inkFaint} />
            <AppText variant="caption">Aucun Flash en ce moment.</AppText>
          </View>
        )}

        {/* Fidélité */}
        <Pressable
          testID="merchant-loyalty-bar"
          accessibilityRole="button"
          accessibilityLabel="Voir ma fidélité"
          onPress={onOpenLoyalty}
          className="flex-row items-center gap-3 rounded-card border border-brand-500 bg-surface-muted p-3.5 active:opacity-80"
        >
          <View className="h-10 w-10 items-center justify-center rounded-pill border border-brand-500">
            <Feather name="star" size={18} color={colors.brand500} />
          </View>
          <View className="flex-1 gap-1">
            <AppText className="font-sans-bold text-ink" style={{ fontSize: 16 }}>
              {loyalty?.points ?? 0} points
            </AppText>
            <AppText variant="caption" className="text-ink-muted" style={{ fontSize: 11 }}>
              {loyalty?.remaining != null
                ? `Plus que ${loyalty.remaining} points avant votre prochain palier`
                : 'Tous les paliers sont débloqués'}
            </AppText>
            <View className="h-1.5 overflow-hidden rounded-pill bg-surface-sunken">
              <View
                className="h-full rounded-pill bg-brand-500"
                style={{ width: `${Math.round((loyalty?.progress ?? 0) * 100)}%` }}
              />
            </View>
          </View>
          <View className="h-10 w-10 items-center justify-center rounded-pill bg-brand-50">
            <Feather name="gift" size={18} color={colors.brand500} />
          </View>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
