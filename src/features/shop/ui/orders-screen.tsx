import { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { AppText, Button, EmptyState, Screen } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import {
  FULFILMENT_LABEL,
  ORDER_STATUS_LABEL,
  STATUS_TONE,
  type OrderStatus,
  type StatusTone,
} from '../lib/order-status';
import { selectOrders, useShopStore } from '../model/store';

type FeatherName = ComponentProps<typeof Feather>['name'];

/**
 * Les dix statuts du CDC §11 se répartissent en quatre tons. Peindre chaque
 * statut d'une couleur propre donnerait un arc-en-ciel illisible ; ce qui
 * compte pour le client, c'est « ça avance / ça attend / c'est fait / c'est
 * raté ».
 */
const TONE_CLASS: Record<StatusTone, string> = {
  attente: 'bg-surface-sunken text-ink-muted',
  encours: 'bg-brand-50 text-brand-600',
  succes: 'bg-success/10 text-success',
  echec: 'bg-surface-sunken text-ink-faint',
};

const STATUS_ICON: Record<OrderStatus, FeatherName> = {
  panier: 'shopping-cart',
  creee: 'file-text',
  paiement_attente: 'clock',
  payee: 'credit-card',
  preparation: 'package',
  prete: 'check-circle',
  recuperee: 'shopping-bag',
  livree: 'check',
  annulee: 'x-circle',
  remboursee: 'corner-up-left',
};

function formatDate(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} · ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function OrdersScreen() {
  const router = useRouter();
  const sync = useShopStore((st) => st.syncOrderStatuses);

  // DÉMO : les commandes avancent avec le temps — la liste doit le refléter
  // sans qu'on ait à quitter puis revenir sur l'écran.
  useEffect(() => {
    sync();
    const t = setInterval(sync, 5000);
    return () => clearInterval(t);
  }, [sync]);
  const orders = useShopStore(selectOrders);

  return (
    <Screen testID="orders-screen">
      <View className="pb-4 pt-2">
        <AppText variant="display">Commandes</AppText>
        <AppText variant="caption">Suivez vos ventes flash en direct</AppText>
      </View>

      {orders.length === 0 ? (
        <EmptyState
          testID="orders-empty"
          title="Aucune commande pour l’instant"
          description="Vos ventes flash apparaîtront ici, avec leur facture QR."
          icon={<Feather name="shopping-bag" size={30} color={colors.inkFaint} />}
          action={<Button label="Découvrir les ventes flash" onPress={() => router.replace('/')} />}
        />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-10">
          {orders.map((order) => {
            const s = {
              label: ORDER_STATUS_LABEL[order.status],
              className: TONE_CLASS[STATUS_TONE[order.status]],
              icon: STATUS_ICON[order.status],
            };
            return (
              <Pressable
                key={order.id}
                testID={`order-${order.id}`}
                accessibilityRole="button"
                accessibilityLabel={`Commande ${order.id.slice(0, 6).toUpperCase()}, ${s.label}`}
                onPress={() =>
                  router.push({ pathname: '/commande/[id]', params: { id: order.id } })
                }
                className="mb-3 gap-3 rounded-card border border-line bg-surface p-4 active:opacity-70"
              >
                <View className="flex-row items-center justify-between">
                  <View>
                    <AppText variant="label">
                      Commande #{order.id.slice(0, 6).toUpperCase()}
                    </AppText>
                    <AppText variant="caption" className="text-ink-faint">
                      {formatDate(order.createdAt)} · {FULFILMENT_LABEL[order.fulfilment]}
                    </AppText>
                  </View>
                  <View
                    className={`flex-row items-center gap-1.5 rounded-pill px-3 py-1.5 ${s.className}`}
                  >
                    <Feather name={s.icon} size={12} color={colors.ink} />
                    <AppText className="font-sans-semibold text-xs">{s.label}</AppText>
                  </View>
                </View>

                <View className="flex-row items-center gap-2">
                  {order.items.slice(0, 5).map((it) => (
                    <View
                      key={it.dealId}
                      className="h-11 w-11 items-center justify-center rounded-control bg-surface-muted"
                    >
                      <AppText style={{ fontSize: 22, lineHeight: 26 }}>{it.emoji}</AppText>
                    </View>
                  ))}
                  <AppText variant="caption" className="text-ink-muted">
                    {order.items.reduce((n, i) => n + i.qty, 0)} article
                    {order.items.reduce((n, i) => n + i.qty, 0) > 1 ? 's' : ''}
                  </AppText>
                </View>

                <View className="flex-row items-center justify-between border-t border-line pt-3">
                  <View className="flex-row items-center gap-1.5">
                    <Feather name="maximize" size={15} color={colors.ink} />
                    <AppText variant="caption" className="font-sans-medium text-ink">
                      Facture QR
                    </AppText>
                    <Feather name="chevron-right" size={14} color={colors.inkFaint} />
                  </View>
                  <View className="flex-row items-center gap-3">
                    <View className="flex-row items-center gap-1">
                      <Feather name="gift" size={13} color={colors.brand600} />
                      <AppText variant="caption" className="font-sans-semibold text-brand-600">
                        +{order.pointsEarned}
                      </AppText>
                    </View>
                    <AppText variant="display" style={{ fontSize: 18 }}>
                      {order.total.toFixed(2)}€
                    </AppText>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </Screen>
  );
}
