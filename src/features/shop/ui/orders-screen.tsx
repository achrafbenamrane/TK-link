import { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { AppText, Button, EmptyState, Screen } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import type { OrderStatus } from '../model/schema';
import { selectOrders, useShopStore } from '../model/store';

type FeatherName = ComponentProps<typeof Feather>['name'];

const STATUS: Record<OrderStatus, { label: string; className: string; icon: FeatherName }> = {
  en_preparation: {
    label: 'En préparation',
    className: 'bg-surface-sunken text-ink-muted',
    icon: 'clock',
  },
  en_livraison: { label: 'En livraison', className: 'bg-brand-50 text-brand-600', icon: 'truck' },
  livree: { label: 'Livrée', className: 'bg-success/10 text-success', icon: 'check' },
};

function formatDate(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} · ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function OrdersScreen() {
  const router = useRouter();
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
            const s = STATUS[order.status];
            return (
              <View
                key={order.id}
                testID={`order-${order.id}`}
                className="mb-3 gap-3 rounded-card border border-line bg-surface p-4"
              >
                <View className="flex-row items-center justify-between">
                  <View>
                    <AppText variant="label">
                      Commande #{order.id.slice(0, 6).toUpperCase()}
                    </AppText>
                    <AppText variant="caption" className="text-ink-faint">
                      {formatDate(order.createdAt)}
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
              </View>
            );
          })}
        </ScrollView>
      )}
    </Screen>
  );
}
