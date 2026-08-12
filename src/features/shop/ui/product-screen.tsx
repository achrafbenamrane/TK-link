import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { getDeal, getMerchant } from '../model/catalog';
import { useShopStore } from '../model/store';
import { Countdown } from './components/countdown';
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
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [qty, setQty] = useState(1);

  const deal = getDeal(dealId);
  const merchant = deal ? getMerchant(deal.merchantId) : undefined;
  const addToCart = useShopStore((s) => s.addToCart);
  const toggleFavorite = useShopStore((s) => s.toggleFavorite);
  const isFav = useShopStore((s) => (deal ? s.favorites.includes(deal.id) : false));

  const goBack = () => (router.canGoBack() ? router.back() : router.push('/'));

  if (!deal) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-surface px-8">
        <AppText variant="title">Offre introuvable</AppText>
        <Pressable onPress={() => router.push('/')} className="rounded-control bg-ink px-5 py-3">
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
        {/* Hero */}
        <View className="h-80 items-center justify-center" style={{ backgroundColor: deal.tint }}>
          <ProductImage deal={deal} emojiSize={128} />

          <View
            className="absolute left-4 flex-row items-center gap-1.5 rounded-control bg-ink px-3 py-2"
            style={{ bottom: 16 }}
          >
            <Feather name="clock" size={13} color={colors.inkInverse} />
            <Countdown seconds={deal.endsInSeconds} className="text-sm text-ink-inverse" />
          </View>
          {discount ? (
            <View
              className="absolute right-4 rounded-control bg-brand-500 px-3 py-1.5"
              style={{ bottom: 16 }}
            >
              <AppText className="font-sans-bold text-sm text-ink-inverse">-{discount}%</AppText>
            </View>
          ) : null}

          <Pressable
            testID="product-back"
            onPress={goBack}
            className="absolute left-4 h-10 w-10 items-center justify-center rounded-pill bg-surface/90"
            style={{ top: insets.top + 6 }}
          >
            <Feather name="chevron-left" size={22} color={colors.ink} />
          </Pressable>
          <Pressable
            testID="product-fav"
            onPress={() => toggleFavorite(deal.id)}
            className="absolute right-4 h-10 w-10 items-center justify-center rounded-pill bg-surface/90"
            style={{ top: insets.top + 6 }}
          >
            <Ionicons
              name={isFav ? 'heart' : 'heart-outline'}
              size={20}
              color={isFav ? colors.brand500 : colors.ink}
            />
          </Pressable>
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
              <Feather name="chevron-right" size={16} color={colors.inkFaint} />
            </View>
          </Pressable>

          {/* Title + tags */}
          <View className="gap-2">
            <AppText variant="display" style={{ fontSize: 24 }}>
              {deal.title}
            </AppText>
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

          {/* Stock */}
          <View className="gap-1.5 rounded-card border border-line bg-surface-muted p-4">
            <View className="flex-row items-center justify-between">
              <AppText variant="label">Stock de la vente flash</AppText>
              <AppText
                variant="caption"
                className={low ? 'font-sans-semibold text-brand-600' : 'text-ink-muted'}
              >
                {low ? `Plus que ${deal.stockLeft} !` : `${deal.stockLeft} / ${deal.stockTotal}`}
              </AppText>
            </View>
            <View className="h-2 overflow-hidden rounded-pill bg-surface-sunken">
              <View
                className={low ? 'h-full rounded-pill bg-brand-500' : 'h-full rounded-pill bg-ink'}
                style={{ width: `${Math.max(6, stockPct)}%` }}
              />
            </View>
          </View>

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
          <Feather name="shopping-bag" size={17} color={colors.inkInverse} />
          <AppText className="font-sans-bold text-ink-inverse">
            Ajouter · {total.toFixed(2)}€
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}
