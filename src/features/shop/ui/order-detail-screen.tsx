import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, type ComponentProps } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { cn } from '@/shared/lib/cn';
import { AppText, Screen } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import {
  ORDER_STATUS_LABEL,
  timelineFor,
  timelineIndex,
  type Fulfilment,
  type OrderStatus,
} from '../lib/order-status';
import type { Order } from '../model/schema';
import { useShopStore } from '../model/store';
import { DeliveryTracker } from './components/delivery-tracker';

type FeatherName = ComponentProps<typeof Feather>['name'];

const STEP_ICON: Record<OrderStatus, FeatherName> = {
  panier: 'shopping-cart',
  creee: 'file-text',
  paiement_attente: 'clock',
  payee: 'credit-card',
  preparation: 'package',
  prete: 'check-circle',
  recuperee: 'shopping-bag',
  livree: 'truck',
  annulee: 'x-circle',
  remboursee: 'corner-up-left',
};

/** Ce que chaque étape veut dire pour le client, selon son mode de retrait. */
function hintFor(status: OrderStatus, fulfilment: Fulfilment): string {
  switch (status) {
    case 'creee':
      return 'Nous avons bien reçu votre commande';
    case 'paiement_attente':
      return 'En attente de la confirmation du paiement';
    case 'payee':
      return 'Paiement confirmé';
    case 'preparation':
      return 'Le commerçant prépare votre commande';
    case 'prete':
      return fulfilment === 'click-collect'
        ? 'À retirer en boutique, présentez votre QR code'
        : 'Confiée au livreur';
    case 'recuperee':
      return 'Récupérée en boutique. Merci !';
    default:
      return 'Bon appétit !';
  }
}

function formatDateTime(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} à ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Fil vertical : où en est la commande, et ce qu'il reste à attendre.
 *
 * Les étapes viennent du mode de retrait — un Click & Collect ne se termine pas
 * par « livrée ». Un statut hors parcours (annulée, remboursée) n'a pas d'index
 * sur la frise : on n'allume alors aucune étape plutôt que d'en désigner une au
 * hasard, ce qui laisserait croire que la commande avance encore.
 */
function Timeline({ status, fulfilment }: { status: OrderStatus; fulfilment: Fulfilment }) {
  const steps = timelineFor(fulfilment);
  const current = timelineIndex(status, fulfilment);
  return (
    <View className="gap-0">
      {steps.map((step, i) => {
        const done = current !== null && i < current;
        const active = current === i;
        return (
          <View key={step} className="flex-row gap-3">
            <View className="items-center">
              <View
                className={cn(
                  'h-9 w-9 items-center justify-center rounded-pill border',
                  done || active ? 'border-brand-500 bg-brand-500' : 'border-line bg-surface-muted',
                )}
              >
                <Feather
                  name={done ? 'check' : STEP_ICON[step]}
                  size={15}
                  color={done || active ? colors.inkInverse : colors.inkFaint}
                />
              </View>
              {i < steps.length - 1 ? (
                <View className={cn('w-0.5 flex-1', done ? 'bg-brand-500' : 'bg-line')} />
              ) : null}
            </View>
            <View className={cn('flex-1', i < steps.length - 1 && 'pb-5')}>
              <AppText
                className={cn(
                  'font-sans-bold',
                  active ? 'text-brand-600' : done ? 'text-ink' : 'text-ink-faint',
                )}
              >
                {ORDER_STATUS_LABEL[step]}
              </AppText>
              <AppText variant="caption" className="text-xs text-ink-faint">
                {hintFor(step, fulfilment)}
              </AppText>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function invoicePayload(order: Order): string {
  return JSON.stringify({ v: 1, id: order.id, t: order.total, n: order.items.length });
}

export function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const order = useShopStore((s) => s.orders.find((o) => o.id === id));
  const address = useShopStore((s) => s.addresses.find((a) => a.id === order?.addressId));
  const sync = useShopStore((s) => s.syncOrderStatuses);

  // DÉMO : la commande avance dans le temps ; on rafraîchit tant que l'écran
  // est ouvert pour que le fil bouge sous les yeux du client.
  useEffect(() => {
    sync();
    const t = setInterval(sync, 5000);
    return () => clearInterval(t);
  }, [sync]);

  if (!order) {
    return (
      <Screen testID="order-detail-screen">
        <View className="flex-1 items-center justify-center gap-2">
          <Feather name="package" size={28} color={colors.inkFaint} />
          <AppText variant="title" className="text-ink-faint">
            Commande introuvable
          </AppText>
        </View>
      </Screen>
    );
  }

  const itemCount = order.items.reduce((n, i) => n + i.qty, 0);

  return (
    <Screen padded={false} testID="order-detail-screen">
      <View className="flex-row items-center gap-3 px-4 pb-3 pt-1">
        <Pressable
          testID="order-back"
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={10}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/commandes'))}
        >
          <Feather name="chevron-left" size={26} color={colors.ink} />
        </Pressable>
        <View className="flex-1">
          <AppText className="font-sans-bold text-ink">
            Commande #{order.id.slice(0, 6).toUpperCase()}
          </AppText>
          <AppText variant="caption" className="text-xs text-ink-faint">
            {formatDateTime(order.createdAt)} · {itemCount} article{itemCount > 1 ? 's' : ''}
          </AppText>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-5 pb-10">
        {/* La carte n'a de sens qu'en course : avant, il n'y a rien à suivre ;
            après, le trajet est terminé. Et jamais en Click & Collect, où
            personne ne se déplace vers le client. */}
        {order.status === 'prete' && order.fulfilment === 'livraison' && address ? (
          <DeliveryTracker order={order} address={address} />
        ) : null}

        <View className="mb-4 rounded-card border border-line bg-surface p-4">
          <Timeline status={order.status} fulfilment={order.fulfilment} />
        </View>

        {/* Adresse — l'ancienne commande n'en a pas, on ne montre rien plutôt
            qu'un bloc vide. Inutile aussi en Click & Collect : le client vient. */}
        {address && order.fulfilment === 'livraison' ? (
          <View className="mb-4 flex-row gap-3 rounded-card border border-line bg-surface p-4">
            <Feather name="map-pin" size={16} color={colors.brand500} />
            <View className="flex-1">
              <AppText className="font-sans-bold text-sm text-ink">
                Livraison · {address.label}
              </AppText>
              <AppText variant="caption" className="text-ink-faint">
                {address.street}, {address.zip} {address.city}
              </AppText>
              {address.notes ? (
                <AppText variant="caption" className="mt-0.5 text-xs text-ink-faint">
                  {address.notes}
                </AppText>
              ) : null}
            </View>
          </View>
        ) : null}

        <View className="mb-4 gap-3 rounded-card border border-line bg-surface p-4">
          <AppText className="font-sans-bold text-ink">Votre commande</AppText>
          {order.items.map((line) => (
            <View key={line.dealId} className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-control bg-surface-muted">
                <AppText style={{ fontSize: 20, lineHeight: 25 }}>{line.emoji}</AppText>
              </View>
              <View className="flex-1">
                <AppText variant="caption" className="font-sans-medium text-ink" numberOfLines={1}>
                  {line.title}
                </AppText>
                <AppText variant="caption" className="text-xs text-ink-faint">
                  {line.qty} × {line.price.toFixed(2)}€
                </AppText>
              </View>
              <AppText variant="label">{(line.price * line.qty).toFixed(2)}€</AppText>
            </View>
          ))}

          <View className="mt-1 gap-1.5 border-t border-line pt-3">
            {order.discount > 0 ? (
              <View className="flex-row justify-between" testID="order-discount">
                <AppText variant="caption" className="text-ink-muted">
                  Réduction {order.couponCode ? `(${order.couponCode})` : ''}
                </AppText>
                <AppText className="font-sans-bold text-sm text-brand-600">
                  −{order.discount.toFixed(2)}€
                </AppText>
              </View>
            ) : null}
            <View className="flex-row justify-between">
              <AppText variant="caption" className="text-ink-muted">
                Livraison
              </AppText>
              <AppText className="font-sans-bold text-sm text-success">
                {order.deliveryFee === 0 ? 'Offerte' : `${order.deliveryFee.toFixed(2)}€`}
              </AppText>
            </View>
            <View className="flex-row items-center justify-between">
              <AppText variant="label">Total</AppText>
              <AppText variant="display" style={{ fontSize: 20, lineHeight: 26 }}>
                {order.total.toFixed(2)}€
              </AppText>
            </View>
            {order.pointsEarned > 0 ? (
              <View className="mt-1 flex-row items-center gap-1.5">
                <Feather name="gift" size={13} color={colors.brand600} />
                <AppText variant="caption" className="font-sans-semibold text-brand-600">
                  +{order.pointsEarned} points gagnés
                </AppText>
              </View>
            ) : null}
          </View>
        </View>

        <View className="items-center gap-3 rounded-card border border-line bg-surface p-5">
          <AppText className="font-sans-bold text-ink">Facture QR</AppText>
          {/* Fond blanc : un QR sur crème perd du contraste et certains
              scanners le refusent. */}
          <View className="rounded-card bg-white p-3">
            <QRCode
              value={invoicePayload(order)}
              size={150}
              color={colors.ink}
              backgroundColor="#FFFFFF"
            />
          </View>
          <AppText variant="caption" className="text-center text-xs text-ink-faint">
            Présentez ce code au commerçant ou au livreur.
          </AppText>
        </View>
      </ScrollView>
    </Screen>
  );
}
