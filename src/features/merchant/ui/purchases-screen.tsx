import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { AppText, Screen } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { formatCents } from '../lib/billing';
import { selectWholesaleOrders, useMerchantStore } from '../model/store';

/** « aujourd'hui », « hier », puis la date — ce qu'on cherche est récent. */
function dayLabel(at: number, nowMs: number): string {
  const day = (ms: number) => new Date(ms).setHours(0, 0, 0, 0);
  const diff = Math.round((day(nowMs) - day(at)) / 86_400_000);
  if (diff <= 0) return 'Aujourd’hui';
  if (diff === 1) return 'Hier';
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/**
 * MES ACHATS EN GROS — CDC §20, côté commerçant.
 *
 * L'app sert au commerçant à S'APPROVISIONNER (décision client du
 * 2026-08-10) : ses ventes se pilotent sur le web. Son onglet « Commandes »
 * doit donc lui montrer ce qu'il a COMMANDÉ aux grossistes, et pas les
 * commandes d'un client qu'il n'est pas.
 *
 * Le total dépensé est en tête parce que c'est la question d'un commerçant
 * devant son historique d'achats : combien j'ai mis ce mois-ci.
 */
export function MerchantPurchasesScreen() {
  const orders = useMerchantStore(selectWholesaleOrders);
  // Instant figé au montage : « aujourd'hui » ne doit pas changer en cours de
  // lecture, et `Date.now()` pendant le rendu rendrait l'écran non idempotent.
  const [now] = useState(() => Date.now());

  const spent = useMemo(() => orders.reduce((sum, o) => sum + o.totalCents, 0), [orders]);
  const lots = useMemo(() => orders.reduce((sum, o) => sum + o.qty, 0), [orders]);

  return (
    <Screen testID="merchant-purchases" padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-10">
        <View className="px-5 pb-3 pt-2">
          <AppText variant="display" className="text-2xl">
            Mes achats
          </AppText>
          <AppText variant="caption" className="mt-0.5">
            Ce que vous avez commandé aux grossistes.
          </AppText>
        </View>

        {orders.length > 0 ? (
          <View className="mx-5 flex-row gap-3">
            <View className="flex-1 rounded-card bg-surface-inverse p-4">
              <AppText className="font-display text-lime" style={{ fontSize: 22 }}>
                {formatCents(spent)}
              </AppText>
              <AppText variant="caption" className="text-ink-inverse/60">
                dépensés
              </AppText>
            </View>
            <View className="flex-1 rounded-card border border-line bg-surface p-4">
              <AppText className="font-display text-ink" style={{ fontSize: 22 }}>
                {lots}
              </AppText>
              <AppText variant="caption" className="text-ink-faint">
                lot{lots > 1 ? 's' : ''} commandé{lots > 1 ? 's' : ''}
              </AppText>
            </View>
          </View>
        ) : null}

        {orders.length === 0 ? (
          <View testID="merchant-purchases-empty" className="mt-12 items-center gap-2 px-10">
            <Feather name="package" size={30} color={colors.inkFaint} />
            <AppText variant="title" className="mt-1 text-center text-base">
              Aucun achat pour l’instant
            </AppText>
            <AppText variant="caption" className="text-center">
              Les lots que vous commandez aux grossistes apparaîtront ici, avec ce qu’ils vous ont
              coûté.
            </AppText>
          </View>
        ) : (
          <View className="mt-4 gap-3 px-5">
            {orders.map((order) => (
              <View
                key={order.id}
                testID={`purchase-${order.id}`}
                className="rounded-card border border-line bg-surface p-4"
              >
                <View className="flex-row items-start gap-2">
                  <View className="flex-1">
                    <AppText className="font-sans-bold text-ink" numberOfLines={2}>
                      {order.title}
                    </AppText>
                    <AppText variant="caption" className="mt-0.5 text-ink-faint">
                      {order.seller || 'Grossiste'} · {dayLabel(order.at, now)}
                    </AppText>
                  </View>
                  <AppText className="font-display text-ink" style={{ fontSize: 17 }}>
                    {formatCents(order.totalCents)}
                  </AppText>
                </View>

                <View className="mt-2 flex-row items-center justify-between border-t border-line pt-2">
                  <AppText variant="caption" className="text-ink-muted">
                    {order.qty} lot{order.qty > 1 ? 's' : ''} × {formatCents(order.unitCents)}
                  </AppText>
                  {/* Le prix unitaire est celui du jour de la commande : un lot
                      qui change de tarif ne réécrit pas cet historique. */}
                  <View className="flex-row items-center gap-1.5">
                    <Feather name="check-circle" size={13} color={colors.brand600} />
                    <AppText className="font-sans-semibold text-brand-600" style={{ fontSize: 12 }}>
                      Commandé
                    </AppText>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
