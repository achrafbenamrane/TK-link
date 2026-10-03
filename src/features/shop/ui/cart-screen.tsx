import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cn } from '@/shared/lib/cn';
import { AppText, Button } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { authenticate } from '../lib/biometrics';
import { FULFILMENTS, FULFILMENT_LABEL, type Fulfilment } from '../lib/order-status';
import { cartLines, DELIVERY_FEE_EUR, selectCart, useShopStore } from '../model/store';
import { QtyStepper } from './components/qty-stepper';

type Props = {
  /**
   * Signalé après une commande réussie. La route s'en sert pour créditer le
   * programme de fidélité de chaque commerçant (CDC §8.2) : le panier ignore
   * tout de la fidélité.
   */
  onOrdered?: (orderId: string) => void;
};

export function CartScreen({ onOrdered }: Props = {}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // CDC §12 — le Touch & Collect fait partie du MVP. Livraison par défaut :
  // c'est le mode que l'app proposait déjà, on ne change pas l'habitude sans
  // que l'utilisateur le demande.
  const [fulfilment, setFulfilment] = useState<Fulfilment>('livraison');

  const cart = useShopStore(selectCart);
  const lines = useMemo(() => cartLines(cart), [cart]);
  const subtotal = useMemo(() => lines.reduce((sum, l) => sum + l.lineTotal, 0), [lines]);
  const addToCart = useShopStore((s) => s.addToCart);
  const decrement = useShopStore((s) => s.decrement);
  const removeFromCart = useShopStore((s) => s.removeFromCart);
  const checkout = useShopStore((s) => s.checkout);
  const addresses = useShopStore((s) => s.addresses);
  const biometricEnabled = useShopStore((s) => s.biometricEnabled);

  const total = subtotal;

  // Les points suivent ce qui est réellement payé (voir checkout).
  const points = Math.round(total);
  // L'adresse par défaut est la cible de livraison ; sans adresse, on ne peut
  // pas commander — une app de livraison doit savoir où aller.
  const address = addresses.find((a) => a.isDefault) ?? addresses[0] ?? null;

  const handleCheckout = async () => {
    // L'adresse n'est indispensable qu'en livraison : exiger une adresse pour
    // venir chercher en boutique bloquerait le Touch & Collect sans raison.
    if (fulfilment === 'livraison' && !address) {
      router.push('/adresses');
      return;
    }

    // L'écran promet « validation par empreinte » : tant que l'option est
    // active, on la tient vraiment plutôt que de l'afficher.
    if (biometricEnabled) {
      const auth = await authenticate('Confirmez votre commande');
      if (!auth.ok && auth.reason !== 'indisponible') return;
    }

    const res = checkout(address?.id ?? null, fulfilment);
    if (res.ok) {
      onOrdered?.(res.orderId);
      router.replace('/commandes');
    }
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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-5 pb-72 pt-1">
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
        {/* Mode de retrait — CDC §12. Le choix se fait AVANT le total, parce
            qu'il le change : le Touch & Collect supprime les frais. */}
        <View className="flex-row gap-2">
          {FULFILMENTS.map((f) => {
            const active = fulfilment === f;
            return (
              <Pressable
                key={f}
                testID={`cart-fulfilment-${f}`}
                accessibilityRole="button"
                accessibilityLabel={FULFILMENT_LABEL[f]}
                accessibilityState={{ selected: active }}
                onPress={() => setFulfilment(f)}
                className={cn(
                  'flex-1 flex-row items-center justify-center gap-2 rounded-control py-2.5',
                  active ? 'bg-ink' : 'bg-surface-muted',
                )}
              >
                <Feather
                  name={f === 'touch-collect' ? 'shopping-bag' : 'truck'}
                  size={14}
                  color={active ? colors.inkInverse : colors.inkMuted}
                />
                <AppText
                  className={cn(
                    'font-sans-semibold',
                    active ? 'text-ink-inverse' : 'text-ink-muted',
                  )}
                  style={{ fontSize: 12.5 }}
                >
                  {FULFILMENT_LABEL[f]}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {/* En Touch & Collect, l'adresse n'a rien à faire là : c'est le client
            qui se déplace. */}
        {fulfilment === 'touch-collect' ? (
          <View
            testID="cart-collect-note"
            className="flex-row items-center gap-3 rounded-control border border-line bg-surface-muted px-3 py-2.5"
          >
            <Feather name="shopping-bag" size={15} color={colors.brand500} />
            <View className="flex-1">
              <AppText className="font-sans-bold text-xs text-ink">Retrait en boutique</AppText>
              <AppText variant="caption" className="text-xs text-ink-faint">
                Présentez le QR code de votre commande au commerçant.
              </AppText>
            </View>
          </View>
        ) : (
          <Pressable
            testID="cart-address"
            accessibilityRole="button"
            accessibilityLabel={
              address ? `Livrer à ${address.label}, modifier` : 'Ajouter une adresse de livraison'
            }
            onPress={() => router.push('/adresses')}
            className="flex-row items-center gap-3 rounded-control border border-line bg-surface-muted px-3 py-2.5"
          >
            <Feather name="map-pin" size={15} color={address ? colors.brand500 : colors.inkFaint} />
            <View className="flex-1">
              {address ? (
                <>
                  <AppText className="font-sans-bold text-xs text-ink">
                    Livrer à {address.label}
                  </AppText>
                  <AppText variant="caption" className="text-xs text-ink-faint" numberOfLines={1}>
                    {address.street}, {address.zip} {address.city}
                  </AppText>
                </>
              ) : (
                <>
                  <AppText className="font-sans-bold text-xs text-brand-600">
                    Adresse de livraison manquante
                  </AppText>
                  <AppText variant="caption" className="text-xs text-ink-faint">
                    Ajoutez une adresse pour être livré.
                  </AppText>
                </>
              )}
            </View>
            <AppText variant="caption" className="font-sans-semibold text-xs text-ink-muted">
              {address ? 'Changer' : 'Ajouter'}
            </AppText>
          </Pressable>
        )}

        <View className="gap-1.5">
          <View className="flex-row items-center justify-between">
            <AppText variant="caption" className="text-ink-muted">
              Sous-total
            </AppText>
            <AppText variant="label">{subtotal.toFixed(2)}€</AppText>
          </View>
          <View className="flex-row items-center justify-between">
            <AppText variant="caption" className="text-ink-muted">
              {FULFILMENT_LABEL[fulfilment]}
            </AppText>
            <AppText className="font-sans-bold text-sm text-success">
              {fulfilment === 'touch-collect' || DELIVERY_FEE_EUR === 0
                ? 'Offerte'
                : `${DELIVERY_FEE_EUR.toFixed(2)}€`}
            </AppText>
          </View>
          <View className="mt-1 flex-row items-center justify-between border-t border-line pt-2">
            <AppText variant="label">Total</AppText>
            <AppText variant="display" style={{ fontSize: 22 }} testID="cart-total">
              {total.toFixed(2)}€
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
            {fulfilment === 'touch-collect' || address
              ? `Payer · ${total.toFixed(2)}€`
              : 'Choisir une adresse'}
          </AppText>
        </Pressable>
        <View className="flex-row items-center justify-center gap-1.5">
          <Feather name="shield" size={12} color={colors.inkFaint} />
          <AppText variant="caption" className="text-xs text-ink-faint">
            {biometricEnabled
              ? 'Paiement sécurisé · validation par empreinte'
              : 'Paiement sécurisé'}
          </AppText>
        </View>
      </View>
    </View>
  );
}
