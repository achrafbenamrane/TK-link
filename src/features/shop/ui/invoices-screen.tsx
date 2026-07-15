import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { AppText, Screen } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import type { Order } from '../model/schema';
import { useShopStore } from '../model/store';

/** Charge utile du QR : ce qu'un commerçant scanne pour retrouver la commande. */
function invoicePayload(order: Order): string {
  return JSON.stringify({
    v: 1,
    id: order.id,
    t: order.total,
    n: order.items.length,
    d: order.createdAt,
  });
}

function formatDate(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function InvoiceCard({ order }: { order: Order }) {
  const [open, setOpen] = useState(false);

  return (
    <Pressable
      testID={`invoice-${order.id}`}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={`Facture ${order.id}, ${order.total.toFixed(2)} euros`}
      onPress={() => setOpen((v) => !v)}
      className="mb-3 overflow-hidden rounded-card border border-line bg-surface"
    >
      <View className="flex-row items-center gap-3 p-4">
        <View className="h-11 w-11 items-center justify-center rounded-control bg-surface-muted">
          <Feather name="maximize" size={18} color={colors.ink} />
        </View>
        <View className="flex-1">
          <AppText className="font-sans-bold text-ink">Facture {order.id}</AppText>
          <AppText variant="caption" className="text-ink-faint">
            {formatDate(order.createdAt)} · {order.items.length} article
            {order.items.length > 1 ? 's' : ''}
          </AppText>
        </View>
        <AppText className="font-display text-base text-ink">{order.total.toFixed(2)}€</AppText>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.inkFaint} />
      </View>

      {open ? (
        <View className="items-center gap-3 border-t border-line px-4 pb-5 pt-5">
          {/* Fond blanc obligatoire : un QR sur crème perd du contraste et
              certains scanners refusent de le lire. */}
          <View className="rounded-card bg-white p-3">
            <QRCode
              value={invoicePayload(order)}
              size={168}
              color={colors.ink}
              backgroundColor="#FFFFFF"
            />
          </View>
          <AppText variant="caption" className="text-center text-ink-faint">
            Présentez ce code au commerçant ou au livreur.
          </AppText>

          <View className="mt-1 w-full gap-1.5">
            {order.items.map((line) => (
              <View key={line.dealId} className="flex-row items-center gap-2">
                <AppText style={{ fontSize: 13 }}>{line.emoji}</AppText>
                <AppText variant="caption" className="flex-1 text-ink-muted" numberOfLines={1}>
                  {line.qty} × {line.title}
                </AppText>
                <AppText variant="caption" className="font-sans-semibold text-ink">
                  {(line.price * line.qty).toFixed(2)}€
                </AppText>
              </View>
            ))}
            <View className="mt-1 flex-row justify-between border-t border-line pt-2">
              <AppText variant="caption" className="text-ink-muted">
                Livraison
              </AppText>
              <AppText variant="caption" className="font-sans-bold text-brand-600">
                {order.deliveryFee === 0 ? 'Offerte' : `${order.deliveryFee.toFixed(2)}€`}
              </AppText>
            </View>
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}

export function InvoicesScreen() {
  const orders = useShopStore((s) => s.orders);

  return (
    <Screen testID="invoices-screen">
      <View className="pb-4 pt-2">
        <AppText variant="display" className="text-3xl">
          Mes factures
        </AppText>
        <AppText variant="caption" className="mt-1">
          Un QR par commande — scannable à la livraison.
        </AppText>
      </View>

      {orders.length === 0 ? (
        <View className="items-center px-10 pt-20" testID="invoices-empty">
          <Feather name="maximize" size={30} color={colors.inkFaint} />
          <AppText variant="title" className="mt-3 text-center text-ink-faint">
            Aucune facture
          </AppText>
          <AppText variant="caption" className="mt-1 text-center">
            Vos factures QR apparaîtront ici après votre première commande.
          </AppText>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-10">
          {orders.map((order) => (
            <InvoiceCard key={order.id} order={order} />
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}
