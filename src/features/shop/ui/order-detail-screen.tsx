import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState, type ComponentProps } from 'react';
import { ScrollView, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { cn } from '@/shared/lib/cn';
import { formatEuros } from '@/shared/lib/money';
import { AppText, HeaderBackButton, Screen } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

import {
  ORDER_STATUS_LABEL,
  timelineFor,
  type Fulfilment,
  type OrderStatus,
} from '../lib/order-status';
import { orderRef } from '../lib/order-summary';
import type { Order } from '../model/schema';
import { useShopStore } from '../model/store';
import { getDeal, getMerchant } from '../model/catalog';
import { useServerOrdersStore } from '../model/server-orders';
import { RateMerchant, ReportIssue } from './components/order-feedback';
import { ServerOrderPanel } from './components/server-order-panel';

/** Statuts après lesquels une commande du serveur n'avance plus : on cesse de la relire. */
const FINAL: readonly OrderStatus[] = ['recuperee', 'livree', 'annulee', 'remboursee', 'refusee'];

/** Le QR se dessine en sombre sur blanc, quel que soit le thème (en Nuit, `ink` est blanc). */
const QR_INK = '#0A0A0D';

type FeatherName = ComponentProps<typeof Feather>['name'];

const STEP_ICON: Record<OrderStatus, FeatherName> = {
  panier: 'shopping-cart',
  creee: 'file-text',
  paiement_attente: 'clock',
  payee: 'credit-card',
  acceptee: 'thumbs-up',
  preparation: 'package',
  prete: 'check-circle',
  en_livraison: 'truck',
  recuperee: 'shopping-bag',
  livree: 'truck',
  refusee: 'slash',
  annulee: 'x-circle',
  remboursement_en_cours: 'rotate-ccw',
  remboursee: 'corner-up-left',
  litige: 'alert-triangle',
};

/** Ce que chaque étape veut dire pour le client, selon son mode de retrait. */
function hintFor(status: OrderStatus, fulfilment: Fulfilment, wholesale = false): string {
  if (wholesale) return wholesaleHint(status, fulfilment);
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
      return fulfilment === 'touch-collect'
        ? 'À retirer en boutique, présentez votre QR code'
        : 'Prête, en attente du coursier';
    // La course est confiée à un coursier partenaire (Uber Direct), plus à un livreur TK LINK.
    case 'en_livraison':
      return 'Un coursier Uber Direct vous l’apporte';
    case 'recuperee':
      return 'Récupérée en boutique. Merci !';
    default:
      return 'Bon appétit !';
  }
}

/**
 * Un achat chez un grossiste (migration 0023) : il prépare et livre lui-même — ni coursier Uber, ni
 * « Bon appétit ». Le commerçant acheteur le lit avec ces mots-là.
 */
function wholesaleHint(status: OrderStatus, fulfilment: Fulfilment): string {
  switch (status) {
    case 'paiement_attente':
      return 'En attente de la confirmation du paiement';
    case 'payee':
      return 'Le grossiste a reçu votre commande';
    case 'preparation':
      return 'Le grossiste prépare votre commande';
    case 'prete':
      return 'À retirer chez le grossiste, avec votre code';
    case 'en_livraison':
      return 'Le grossiste l’a expédiée à votre commerce';
    case 'recuperee':
      return 'Retirée chez le grossiste';
    case 'livree':
      return 'Livrée à votre commerce';
    default:
      return fulfilment === 'livraison' ? 'Livrée par le grossiste' : 'Retrait chez le grossiste';
  }
}

/** Les étapes d'un achat B2B : pas d'acceptation (CDC V1.1), et pas de « prête » quand il expédie. */
function stepsFor(fulfilment: Fulfilment, wholesale: boolean): OrderStatus[] {
  const steps = timelineFor(fulfilment);
  if (!wholesale) return steps;
  return steps.filter((s) => s !== 'acceptee' && !(fulfilment === 'livraison' && s === 'prete'));
}

function formatDateTime(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} à ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Fil vertical : où en est la commande, et ce qu'il reste à attendre.
 *
 * Les étapes viennent du mode de retrait — un Touch & Collect ne se termine pas
 * par « livrée ». Un statut hors parcours (annulée, remboursée) n'a pas d'index
 * sur la frise : on n'allume alors aucune étape plutôt que d'en désigner une au
 * hasard, ce qui laisserait croire que la commande avance encore.
 */
function Timeline({
  status,
  fulfilment,
  wholesale = false,
}: {
  status: OrderStatus;
  fulfilment: Fulfilment;
  wholesale?: boolean;
}) {
  const colors = useColors();
  const steps = stepsFor(fulfilment, wholesale);
  const index = steps.indexOf(status);
  const current = index === -1 ? null : index;
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
                {wholesale && step === 'en_livraison' ? 'Expédiée' : ORDER_STATUS_LABEL[step]}
              </AppText>
              <AppText variant="caption" className="text-xs text-ink-faint">
                {hintFor(step, fulfilment, wholesale)}
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

type Props = {
  /**
   * Un achat chez un grossiste (migration 0023) — la route le sait par le rôle : un compte commerçant
   * n’achète qu’aux grossistes. Ses mots, ses étapes, et pas de points de client.
   */
  wholesale?: boolean;
};

export function OrderDetailScreen({ wholesale = false }: Props = {}) {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const local = useShopStore((s) => s.orders.find((o) => o.id === id));
  // Une commande du SERVEUR (payée sur la page Stripe, suivie par le serveur).
  const server = useServerOrdersStore((s) => s.mine.find((o) => o.id === id));
  const refreshMine = useServerOrdersStore((s) => s.refreshMine);
  const order = local ?? server;
  const address = useShopStore((s) => s.addresses.find((a) => a.id === order?.addressId));
  const sync = useShopStore((s) => s.syncOrderStatuses);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // DÉMO : la commande avance dans le temps ; on rafraîchit tant que l'écran
  // est ouvert pour que le fil bouge sous les yeux du client.
  useEffect(() => {
    sync();
    const t = setInterval(sync, 5000);
    return () => clearInterval(t);
  }, [sync]);

  // SERVEUR : relire la commande toutes les 5 s tant qu'elle avance (paiement confirmé par le
  // webhook Stripe, préparation, coursier Uber…). Pas pour une commande locale.
  const serverStatus = server?.status;
  useEffect(() => {
    if (local) return;
    if (serverStatus && FINAL.includes(serverStatus)) return;
    let alive = true;
    const tick = () =>
      void refreshMine().then(() => {
        if (!alive) return;
        setLoaded(true);
        setNow(Date.now());
      });
    tick();
    const t = setInterval(tick, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [local, serverStatus, refreshMine]);

  if (!order && !loaded && !local) {
    return (
      <Screen testID="order-detail-screen">
        <View className="flex-1 items-center justify-center gap-2" testID="order-loading">
          <Feather name="loader" size={24} color={colors.inkFaint} />
          <AppText variant="caption">Chargement de la commande…</AppText>
        </View>
      </Screen>
    );
  }

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

  const isServer = !local && Boolean(server);
  const itemCount = order.items.reduce((n, i) => n + i.qty, 0);
  const firstDeal = order.items[0] ? getDeal(order.items[0].dealId) : undefined;
  const merchantName = (firstDeal && getMerchant(firstDeal.merchantId)?.name) || 'le commerçant';

  return (
    <Screen padded={false} testID="order-detail-screen">
      <View className="flex-row items-center gap-3 px-4 pb-3 pt-1">
        <HeaderBackButton
          testID="order-back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/commandes'))}
        />
        <View className="flex-1">
          <AppText className="font-sans-bold text-ink">Commande {orderRef(order.id)}</AppText>
          <AppText variant="caption" className="text-xs text-ink-faint">
            {formatDateTime(order.createdAt)} · {itemCount} article{itemCount > 1 ? 's' : ''}
          </AppText>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-5 pb-10">
        <View className="mb-4 rounded-card border border-line bg-surface p-4">
          <Timeline status={order.status} fulfilment={order.fulfilment} wholesale={wholesale} />
        </View>

        {/* Adresse — l'ancienne commande n'en a pas, on ne montre rien plutôt
            qu'un bloc vide. Inutile aussi en Touch & Collect : le client vient. */}
        {server && !local && order.fulfilment === 'livraison' && server.deliveryAddress ? (
          <View
            testID="order-server-address"
            className="mb-4 flex-row gap-3 rounded-card border border-line bg-surface p-4"
          >
            <Feather name="map-pin" size={16} color={colors.brand500} />
            <AppText variant="caption" className="flex-1 text-ink-muted">
              Livraison · {server.deliveryAddress}
            </AppText>
          </View>
        ) : null}

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
                  {line.qty} × {formatEuros(line.price)}
                </AppText>
              </View>
              <AppText variant="label">{formatEuros(line.price * line.qty)}</AppText>
            </View>
          ))}

          <View className="mt-1 gap-1.5 border-t border-line pt-3">
            {order.discount > 0 ? (
              <View className="flex-row justify-between" testID="order-discount">
                <AppText variant="caption" className="text-ink-muted">
                  Réduction
                </AppText>
                <AppText className="font-sans-bold text-sm text-brand-600">
                  −{formatEuros(order.discount)}
                </AppText>
              </View>
            ) : null}
            <View className="flex-row justify-between">
              <AppText variant="caption" className="text-ink-muted">
                Livraison
              </AppText>
              <AppText className="font-sans-bold text-sm text-success">
                {wholesale
                  ? 'Par le grossiste'
                  : order.deliveryFee === 0
                    ? 'Offerte'
                    : `${formatEuros(order.deliveryFee)}`}
              </AppText>
            </View>
            <View className="flex-row items-center justify-between">
              <AppText variant="label">Total</AppText>
              <AppText
                testID="order-total"
                variant="display"
                style={{ fontSize: 20, lineHeight: 26 }}
              >
                {formatEuros(order.total + order.deliveryFee)}
              </AppText>
            </View>
            {order.pointsEarned > 0 && !wholesale ? (
              <View className="mt-1 flex-row items-center gap-1.5">
                <Feather name="gift" size={13} color={colors.brand600} />
                <AppText variant="caption" className="font-sans-semibold text-brand-600">
                  +{order.pointsEarned} points gagnés
                </AppText>
              </View>
            ) : null}
          </View>
        </View>

        {server && isServer ? (
          <ServerOrderPanel order={server} now={now} onChanged={() => void refreshMine()} />
        ) : null}

        {isServer ? null : <RateMerchant order={order} merchantName={merchantName} />}

        {isServer ? null : (
          <View className="items-center gap-3 rounded-card border border-line bg-surface p-5">
            <AppText className="font-sans-bold text-ink">Facture QR</AppText>
            {/* Fond blanc : un QR sur crème perd du contraste et certains
              scanners le refusent. */}
            <View className="rounded-card bg-white p-3">
              <QRCode
                value={invoicePayload(order)}
                size={150}
                color={QR_INK}
                backgroundColor="#FFFFFF"
              />
            </View>
            <AppText variant="caption" className="text-center text-xs text-ink-faint">
              Présentez ce code au commerçant.
            </AppText>
          </View>
        )}

        {/* Point d'entrée UNIQUE — CDC V1.1. Une commande du serveur passe par le support. */}
        {isServer ? null : (
          <View className="mt-4">
            <ReportIssue order={order} />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
