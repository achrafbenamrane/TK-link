import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText, Screen } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

import { formatCents } from '../lib/billing';
import {
  isOpenWholesale,
  WHOLESALE_ACTION_LABEL,
  WHOLESALE_STATUS_LABEL,
  type WholesaleStatus,
} from '../lib/wholesale-orders';
import { selectWholesaleOrders, useMerchantStore } from '../model/store';

const TONE: Record<WholesaleStatus, string> = {
  recue: 'border-warning text-warning',
  preparation: 'border-accent text-accent-deep',
  expediee: 'border-accent text-accent-deep',
  livree: 'border-success text-success',
  terminee: 'border-line text-ink-muted',
};

/**
 * LES COMMANDES REÇUES DES COMMERÇANTS — l'écran de service du grossiste, étapes 10 à 12 de
 * son schéma : notification, bon de préparation et emballage, expédition, livraison.
 *
 * Statuts : Commande reçue → En préparation → Expédiée → Livrée → Terminée. Pas de geste
 * « Accepter » : la commande payée vaut acceptation (CDC V1.1, Grossiste).
 */
export function WholesalerOrdersScreen({ onBack }: { onBack?: () => void }) {
  const colors = useColors();
  const orders = useMerchantStore(selectWholesaleOrders);
  const advance = useMerchantStore((s) => s.advanceWholesaleOrder);
  const [done, setDone] = useState(false);

  const shown = useMemo(
    () => orders.filter((o) => isOpenWholesale(o.status) !== done),
    [orders, done],
  );
  const todo = orders.filter((o) => o.status === 'recue').length;

  return (
    <Screen testID="wholesaler-orders" padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-3 px-5 pb-10">
        <View className="flex-row items-center gap-3 pt-2">
          {onBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retour"
              hitSlop={10}
              onPress={onBack}
            >
              <Feather name="chevron-left" size={26} color={colors.ink} />
            </Pressable>
          ) : null}
          <View className="flex-1">
            <AppText variant="display" className="text-2xl">
              Commandes des commerçants
            </AppText>
            <AppText variant="caption" className="mt-0.5">
              {todo > 0
                ? `${todo} commande${todo > 1 ? 's' : ''} à préparer.`
                : 'Rien en attente pour l’instant.'}
            </AppText>
          </View>
        </View>

        <View className="flex-row gap-2">
          {(
            [
              { key: false, label: 'À traiter' },
              { key: true, label: 'Terminées' },
            ] as const
          ).map((f) => (
            <Pressable
              key={String(f.key)}
              testID={`wholesaler-filter-${f.key ? 'done' : 'active'}`}
              accessibilityRole="button"
              accessibilityState={{ selected: done === f.key }}
              onPress={() => setDone(f.key)}
              className={cn(
                'rounded-pill px-4 py-2',
                done === f.key ? 'bg-brand-500' : 'bg-surface-muted',
              )}
            >
              <AppText
                className={cn(
                  'font-sans-semibold',
                  done === f.key ? 'text-white' : 'text-ink-muted',
                )}
                style={{ fontSize: 13 }}
              >
                {f.label}
              </AppText>
            </Pressable>
          ))}
        </View>

        {shown.length === 0 ? (
          <View testID="wholesaler-orders-empty" className="items-center gap-2 px-8 pt-12">
            <Feather name="inbox" size={30} color={colors.inkFaint} />
            <AppText variant="title" className="text-center text-base">
              {done ? 'Aucune commande terminée' : 'Aucune commande en attente'}
            </AppText>
            <AppText variant="caption" className="text-center">
              Les commandes des commerçants arrivent ici dès qu’elles sont payées : le bon de
              préparation est prêt tout de suite.
            </AppText>
          </View>
        ) : (
          shown.map((o) => {
            const action = WHOLESALE_ACTION_LABEL[o.status];
            return (
              <View
                key={o.id}
                testID={`wholesaler-order-${o.id}`}
                className="gap-2.5 rounded-card border border-line bg-surface-muted p-4"
              >
                <View className="flex-row items-start gap-2">
                  <View className="flex-1">
                    <AppText className="font-sans-bold text-ink" numberOfLines={2}>
                      {o.title}
                    </AppText>
                    <AppText variant="caption" className="mt-0.5 text-ink-faint">
                      #B2B-{o.id.slice(-5).toUpperCase()}
                      {o.buyer ? ` · ${o.buyer}` : ''} ·{' '}
                      {new Date(o.at).toLocaleDateString('fr-FR')}
                    </AppText>
                  </View>
                  <View className={cn('rounded-sm border px-2 py-1', TONE[o.status].split(' ')[0])}>
                    <AppText
                      className={cn('font-sans-bold', TONE[o.status].split(' ')[1])}
                      style={{ fontSize: 10 }}
                    >
                      {WHOLESALE_STATUS_LABEL[o.status].toUpperCase()}
                    </AppText>
                  </View>
                </View>

                <View className="flex-row items-center justify-between border-t border-line pt-2">
                  <AppText className="text-ink-muted" style={{ fontSize: 13 }}>
                    {o.qty} lot{o.qty > 1 ? 's' : ''} × {formatCents(o.unitCents)}
                  </AppText>
                  <AppText className="font-sans-bold text-ink" style={{ fontSize: 15 }}>
                    {formatCents(o.totalCents)}
                  </AppText>
                </View>

                {o.status === 'preparation' ? (
                  <View className="flex-row items-center gap-1.5">
                    <Feather name="clipboard" size={13} color={colors.inkMuted} />
                    <AppText variant="caption" className="text-ink-muted">
                      Bon de préparation, emballage, puis expédition.
                    </AppText>
                  </View>
                ) : null}

                {action ? (
                  <Pressable
                    testID={`wholesaler-order-${o.id}-advance`}
                    accessibilityRole="button"
                    accessibilityLabel={action}
                    onPress={() => advance(o.id)}
                    className="items-center rounded-control bg-brand-500 py-3 active:bg-brand-600"
                  >
                    <AppText className="font-sans-bold text-white" style={{ fontSize: 13.5 }}>
                      {action}
                    </AppText>
                  </Pressable>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}
