import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { cartLines, DELIVERY_FEE_EUR, selectCart, useShopStore } from '../model/store';
import { QtyStepper } from './components/qty-stepper';

export function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const cart = useShopStore(selectCart);
  const lines = useMemo(() => cartLines(cart), [cart]);
  const subtotal = useMemo(() => lines.reduce((sum, l) => sum + l.lineTotal, 0), [lines]);
  const addToCart = useShopStore((s) => s.addToCart);
  const decrement = useShopStore((s) => s.decrement);
  const removeFromCart = useShopStore((s) => s.removeFromCart);
  const checkout = useShopStore((s) => s.checkout);

  const points = Math.round(subtotal);

  const handleCheckout = () => {
    const res = checkout();
    if (res.ok) router.replace('/commandes');
  };

  const Header = (
    <View className="flex-row items-center gap-3 px-5 pb-3" style={{ paddingTop: insets.top + 6 }}>
      <Pressable
        testID="cart-back"
        onPress={() => (router.canGoBack() ? router.back() : router.push('/'))}
        className="h-10 w-10 items-center justify-center rounded-pill bg-surface-muted"
      >
        <Feather name="chevron-left" size={22} color={colors.ink} />
      </Pressable>
      <AppText variant="display" style={{ fontSize: 22 }}>
        Panier
      </AppText>
    </View>
  );

  if (lines.length === 0) {
    return (
      <View className="flex-1 bg-surface">
        {Header}
        <View className="flex-1 items-center justify-center gap-3 px-10" testID="cart-empty">
          <View className="h-16 w-16 items-center justify-center rounded-pill bg-surface-muted">
            <Feather name="shopping-bag" size={26} color={colors.inkFaint} />
          </View>
          <AppText variant="title" className="text-center">
            Votre panier est vide
          </AppText>
          <AppText variant="caption" className="text-center">
            Les ventes flash de votre quartier n’attendent que vous.
          </AppText>
          <View className="mt-2 w-full max-w-xs">
            <Button label="Découvrir les ventes flash" onPress={() => router.replace('/')} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface">
      {Header}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-5 pb-64 pt-1">
        {lines.map((line) => (
          <View
            key={line.deal.id}
            testID={`cart-line-${line.deal.id}`}
            className="mb-3 flex-row items-center gap-3 rounded-card border border-line bg-surface p-3"
          >
            <View
              className="h-16 w-16 items-center justify-center rounded-control"
              style={{ backgroundColor: line.deal.tint }}
            >
              <AppText style={{ fontSize: 34, lineHeight: 40 }}>{line.deal.emoji}</AppText>
            </View>
            <View className="flex-1 gap-1">
              <View className="flex-row items-start justify-between">
                <AppText variant="title" className="flex-1 pr-2 text-sm" numberOfLines={1}>
                  {line.deal.title}
                </AppText>
                <Pressable
                  onPress={() => removeFromCart(line.deal.id)}
                  hitSlop={6}
                  accessibilityLabel="Retirer du panier"
                >
                  <Feather name="x" size={18} color={colors.inkFaint} />
                </Pressable>
              </View>
              <AppText variant="caption" className="text-ink-faint">
                {line.deal.price.toFixed(2)}€ · {line.deal.unit}
              </AppText>
              <View className="mt-1 flex-row items-center justify-between">
                <QtyStepper
                  qty={line.qty}
                  onInc={() => addToCart(line.deal.id)}
                  onDec={() => decrement(line.deal.id)}
                />
                <AppText className="font-display text-base">{line.lineTotal.toFixed(2)}€</AppText>
              </View>
            </View>
          </View>
        ))}

        <View className="mt-2 flex-row items-center gap-2 rounded-card bg-surface-muted p-3.5">
          <Feather name="gift" size={18} color={colors.brand600} />
          <AppText variant="caption" className="flex-1 text-ink-muted">
            Vous gagnerez <AppText className="font-sans-bold text-ink">{points} points</AppText> de
            fidélité avec cette commande.
          </AppText>
        </View>
      </ScrollView>

      {/* Summary + checkout */}
      <View
        className="absolute inset-x-0 bottom-0 gap-3 rounded-t-card border-t border-line bg-surface px-5 pt-4"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <View className="gap-1.5">
          <View className="flex-row items-center justify-between">
            <AppText variant="caption" className="text-ink-muted">
              Sous-total
            </AppText>
            <AppText variant="label">{subtotal.toFixed(2)}€</AppText>
          </View>
          <View className="flex-row items-center justify-between">
            <AppText variant="caption" className="text-ink-muted">
              Livraison
            </AppText>
            <AppText className="font-sans-bold text-sm text-success">
              {DELIVERY_FEE_EUR === 0 ? 'Offerte' : `${DELIVERY_FEE_EUR.toFixed(2)}€`}
            </AppText>
          </View>
          <View className="mt-1 flex-row items-center justify-between border-t border-line pt-2">
            <AppText variant="label">Total</AppText>
            <AppText variant="display" style={{ fontSize: 22 }}>
              {subtotal.toFixed(2)}€
            </AppText>
          </View>
        </View>

        <Pressable
          testID="cart-checkout"
          onPress={handleCheckout}
          className="flex-row items-center justify-center gap-2 rounded-control bg-brand-500 py-4 active:bg-brand-600"
        >
          <Feather name="lock" size={16} color={colors.inkInverse} />
          <AppText className="font-sans-bold text-ink-inverse">
            Payer · {subtotal.toFixed(2)}€
          </AppText>
        </Pressable>
        <View className="flex-row items-center justify-center gap-1.5">
          <Feather name="shield" size={12} color={colors.inkFaint} />
          <AppText variant="caption" className="text-xs text-ink-faint">
            Paiement sécurisé · validation par empreinte
          </AppText>
        </View>
      </View>
    </View>
  );
}
