import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

import { distanceKm } from '../lib/geo';
import { getDeal, getMerchant } from '../model/catalog';
import { useShopStore } from '../model/store';
import { CountdownBlocks } from './components/countdown';
import { ProductImage } from './components/product-image';
import { QtyStepper } from './components/qty-stepper';
import { ScreeningStrip } from './components/screening-strip';

type Props = { dealId: string };

const TRUST = [
  { icon: 'truck', label: 'Livraison\nofferte' },
  { icon: 'shield', label: 'Paiement\nsécurisé' },
  { icon: 'maximize', label: 'Facture\nQR' },
] as const;

export function ProductScreen({ dealId }: Props) {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [qty, setQty] = useState(1);

  const deal = getDeal(dealId);
  const merchant = deal ? getMerchant(deal.merchantId) : undefined;
  const addToCart = useShopStore((s) => s.addToCart);
  const toggleFavorite = useShopStore((s) => s.toggleFavorite);
  const isFav = useShopStore((s) => (deal ? s.favorites.includes(deal.id) : false));

  const userCoord = useShopStore((s) => s.userCoord);
  const distance = userCoord && merchant ? distanceKm(userCoord, merchant.coord) : null;

  const goBack = () => (router.canGoBack() ? router.back() : router.push('/'));

  if (!deal) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-surface px-8">
        <AppText variant="title">Offre introuvable</AppText>
        <Pressable
          onPress={() => router.push('/')}
          className="rounded-control bg-surface-inverse px-5 py-3"
        >
          <AppText className="font-sans-bold text-ink-inverse">Retour à l’accueil</AppText>
        </Pressable>
      </View>
    );
  }

  const discount = deal.oldPrice ? Math.round((1 - deal.price / deal.oldPrice) * 100) : null;
  const stockPct = Math.round((deal.stockLeft / deal.stockTotal) * 100);
  const low = deal.stockLeft <= deal.stockTotal * 0.25;
  const total = deal.price * qty;

  const addAndGo = () => {
    addToCart(deal.id, qty);
    router.push('/panier');
  };

  return (
    <View className="flex-1 bg-surface">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140 }}
      >
        {/* Retour · favori */}
        <View
          className="flex-row items-center justify-between px-4 pb-2"
          style={{ paddingTop: insets.top + 6 }}
        >
          <Pressable
            testID="product-back"
            accessibilityRole="button"
            accessibilityLabel="Retour"
            onPress={goBack}
            className="h-10 w-10 items-center justify-center rounded-pill bg-surface-muted"
          >
            <Feather name="chevron-left" size={22} color={colors.ink} />
          </Pressable>
          <Pressable
            testID="product-fav"
            accessibilityRole="button"
            accessibilityLabel={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            onPress={() => toggleFavorite(deal.id)}
            className="h-10 w-10 items-center justify-center rounded-pill bg-surface-muted"
          >
            <Ionicons
              name={isFav ? 'heart' : 'heart-outline'}
              size={20}
              color={isFav ? colors.brand500 : colors.ink}
            />
          </Pressable>
        </View>

        {/* LA CARTE « OFFRE FLASH » — direction A du client : bandeau rose, remise en
            pastille ronde, prix barré et prix Flash, « FIN DANS » en trois blocs,
            jauge « Stock restant », distance. */}
        <View
          testID="product-flash-card"
          className="mx-4 overflow-hidden rounded-card border border-brand-500 bg-surface-muted"
        >
          <View className="flex-row items-center justify-center gap-2 bg-brand-500 py-3">
            <Feather name="zap" size={20} color="#FFFFFF" />
            <AppText className="font-display text-white" style={{ fontSize: 20 }}>
              OFFRE FLASH
            </AppText>
          </View>

          <View
            className="h-56 items-center justify-center overflow-hidden"
            style={{ backgroundColor: deal.tint }}
          >
            <ProductImage deal={deal} emojiSize={110} />
            {discount ? (
              <View className="absolute left-3 top-3 h-16 w-16 items-center justify-center rounded-pill bg-brand-500">
                <AppText className="font-display text-white" style={{ fontSize: 19 }}>
                  -{discount}%
                </AppText>
              </View>
            ) : null}
          </View>

          <View className="flex-row items-end justify-between gap-3 px-4 pb-1 pt-3">
            <View className="flex-1">
              <AppText
                className="font-sans-bold text-ink"
                style={{ fontSize: 16 }}
                numberOfLines={2}
              >
                {deal.title}
              </AppText>
              {deal.unit ? (
                <AppText variant="caption" className="text-ink-muted">
                  {deal.unit}
                </AppText>
              ) : null}
              {deal.oldPrice ? (
                <AppText className="mt-0.5 text-ink-faint line-through" style={{ fontSize: 15 }}>
                  {deal.oldPrice.toFixed(2).replace('.', ',')}€
                </AppText>
              ) : null}
            </View>
            <AppText className="font-display text-brand-500" style={{ fontSize: 34 }}>
              {deal.price.toFixed(2).split('.')[0]}
              <AppText className="font-display text-brand-500" style={{ fontSize: 20 }}>
                ,{deal.price.toFixed(2).split('.')[1]}€
              </AppText>
            </AppText>
          </View>

          <View className="items-center gap-1.5 px-4 pb-3 pt-3">
            <View className="flex-row items-center gap-1.5">
              <Feather name="clock" size={13} color={colors.brand500} />
              <AppText className="text-ink-muted" style={{ fontSize: 12 }}>
                FIN DANS
              </AppText>
            </View>
            <CountdownBlocks testID="product-countdown" seconds={deal.endsInSeconds} size={30} />
          </View>

          <View className="gap-2 border-t border-line px-4 py-3">
            <View className="flex-row items-center gap-3">
              <AppText className="text-ink-muted" style={{ fontSize: 13 }}>
                Stock restant
              </AppText>
              <View className="h-2 flex-1 overflow-hidden rounded-pill bg-surface-sunken">
                <View
                  className="h-full rounded-pill bg-brand-500"
                  style={{ width: `${Math.max(6, stockPct)}%` }}
                />
              </View>
              <AppText
                testID="product-stock"
                className={low ? 'font-sans-bold text-brand-500' : 'font-sans-bold text-ink'}
                style={{ fontSize: 13 }}
              >
                {deal.stockLeft} / {deal.stockTotal}
              </AppText>
            </View>
            {distance !== null ? (
              <View className="flex-row items-center gap-1.5">
                <Feather name="map-pin" size={13} color={colors.brand500} />
                <AppText
                  testID="product-distance"
                  className="text-ink-muted"
                  style={{ fontSize: 13 }}
                >
                  À {distance.toFixed(1).replace('.', ',')} km de toi
                </AppText>
              </View>
            ) : null}
          </View>
        </View>

        {/* Body */}
        <View className="gap-4 px-5 pt-5">
          {/* Merchant — ouvre sa fiche : ventes flash, fidélité, infos. */}
          <Pressable
            testID="product-merchant"
            accessibilityRole="button"
            accessibilityLabel={`Voir ${merchant?.name ?? 'le commerçant'}`}
            onPress={() =>
              merchant && router.push({ pathname: '/enseigne/[id]', params: { id: merchant.id } })
            }
            className="flex-row items-center justify-between active:opacity-70"
          >
            <View className="flex-1 flex-row items-center gap-2 pr-2">
              <View className="h-9 w-9 items-center justify-center rounded-pill bg-surface-muted">
                <AppText style={{ fontSize: 18 }}>{merchant?.emoji}</AppText>
              </View>
              <View>
                <AppText variant="label" numberOfLines={1}>
                  {merchant?.name}
                </AppText>
                <AppText variant="caption" className="text-ink-faint">
                  {merchant?.area} · Toulouse
                </AppText>
              </View>
            </View>
            <View className="flex-row items-center gap-1">
              <Ionicons name="star" size={14} color={colors.brand500} />
              <AppText variant="label">{deal.rating.toFixed(1)}</AppText>
              {/* Le nombre d'avis, exigé par les affiches à côté de la note. */}
              {deal.reviewCount ? (
                <AppText testID="product-reviews" variant="caption" className="text-ink-faint">
                  ({deal.reviewCount} avis)
                </AppText>
              ) : null}
              <Feather name="chevron-right" size={16} color={colors.inkFaint} />
            </View>
          </Pressable>

          {/* Title + tags */}
          <View className="gap-2">
            <View className="flex-row flex-wrap items-center gap-2">
              {merchant?.halal ? (
                <View className="rounded-pill bg-success/10 px-2.5 py-1">
                  <AppText className="font-sans-semibold text-xs text-success">Halal</AppText>
                </View>
              ) : null}
              {deal.origin ? (
                <View className="flex-row items-center gap-1 rounded-pill bg-surface-muted px-2.5 py-1">
                  <AppText className="font-sans-semibold text-xs text-ink-muted">
                    {deal.origin}
                  </AppText>
                </View>
              ) : null}
              {deal.perk ? (
                <View className="flex-row items-center gap-1 rounded-pill bg-brand-50 px-2.5 py-1">
                  <Feather name="tag" size={11} color={colors.brand600} />
                  <AppText className="font-sans-semibold text-xs text-brand-600">
                    {deal.perk}
                  </AppText>
                </View>
              ) : null}
            </View>
          </View>

          {/* La séance en tête de fiche : avant même de lire la description,
              on doit savoir quel film et à quelle heure — et si l'on aura le
              temps d'y être. D'où l'heure de fin, absente de la carte. */}
          {deal.screening ? (
            <ScreeningStrip testID="product-screening" screening={deal.screening} expanded />
          ) : null}

          <AppText variant="body" className="leading-relaxed text-ink-muted">
            {deal.description}
          </AppText>

          {/* Trust */}
          <View className="mt-1 flex-row justify-between rounded-card border border-line p-4">
            {TRUST.map((t) => (
              <View key={t.label} className="flex-1 items-center gap-1.5">
                <Feather name={t.icon} size={19} color={colors.ink} />
                <AppText variant="caption" className="text-center text-xs text-ink-muted">
                  {t.label}
                </AppText>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Sticky action bar */}
      <View
        className="absolute inset-x-0 bottom-0 flex-row items-center gap-3 border-t border-line bg-surface px-5 pt-3"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <QtyStepper
          qty={qty}
          onInc={() => setQty(qty + 1)}
          onDec={() => setQty(Math.max(1, qty - 1))}
        />
        <Pressable
          testID="product-add"
          onPress={addAndGo}
          className="flex-1 flex-row items-center justify-center gap-2 rounded-control bg-brand-500 py-4 active:bg-brand-600"
        >
          {/* « J'EN PROFITE » — l'appel à l'action des quatre affiches, et le
              seul de la fiche. « Ajouter » décrit un geste d'interface ; « j'en
              profite » dit ce qu'on y gagne, et c'est le mot que le client a
              choisi pour sa marque. Le montant reste collé au bouton : personne
              ne doit découvrir le total à l'écran suivant. */}
          <Feather name="shopping-bag" size={17} color={colors.inkInverse} />
          <AppText className="font-sans-bold text-ink-inverse">
            J’EN PROFITE · {total.toFixed(2)}€
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}
