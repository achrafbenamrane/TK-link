import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText, Screen } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import {
  FULFILMENT_LABEL,
  isActive,
  nextStatuses,
  ORDER_STATUS_LABEL,
  type OrderStatus,
} from '../lib/order-status';
import type { Order } from '../model/schema';
import { selectOrders, useShopStore } from '../model/store';

type Props = {
  /**
   * Les offres de ce commerçant. Une commande le concerne dès qu'une de ses
   * lignes porte l'une d'elles. Fourni par la ROUTE : la boutique ignore
   * l'espace commerçant, où les publications sont conservées.
   */
  dealIds?: string[];
  onBack?: () => void;
};

/** Ce que le commerçant doit faire ensuite, dit avec ses mots à lui. */
const ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  payee: 'Accepter',
  preparation: 'En préparation',
  prete: 'C’est prêt',
  recuperee: 'Remise au client',
  livree: 'Livrée',
  annulee: 'Refuser',
};

/** Couleur de la pastille de statut : ce qui attend une action doit ressortir. */
function toneOf(status: OrderStatus): string {
  if (status === 'annulee' || status === 'remboursee') return 'bg-surface-sunken text-ink-faint';
  if (status === 'recuperee' || status === 'livree') return 'bg-brand-50 text-brand-700';
  return 'bg-ink text-ink-inverse';
}

function money(value: number): string {
  return `${value.toFixed(2).replace('.', ',')} €`;
}

/**
 * LES COMMANDES REÇUES — CDC §11 et §18.
 *
 * Le commerçant publiait ses invendus sans jamais savoir qui les avait pris :
 * la boucle s'arrêtait au paiement. Cet écran la referme, et il est fait pour
 * être utilisé DEBOUT, derrière un comptoir — une commande, un bouton, le
 * geste suivant.
 *
 * Les transitions passent par la machine à états du §11 : impossible de
 * proposer « livrée » sur un Touch & Collect, ni de ressusciter une commande
 * remboursée. C'est la même règle que côté client, testée une seule fois.
 */
export function MerchantOrdersScreen({ dealIds, onBack }: Props) {
  const allOrders = useShopStore(selectOrders);
  const setOrderStatus = useShopStore((s) => s.setOrderStatus);
  const [done, setDone] = useState(false);

  const mine = useMemo(() => {
    const wanted = new Set(dealIds ?? []);
    if (wanted.size === 0) return [];
    return allOrders.filter((o) => o.items.some((line) => wanted.has(line.dealId)));
  }, [allOrders, dealIds]);

  const shown = useMemo(
    () => mine.filter((o) => (done ? !isActive(o.status) : isActive(o.status))),
    [mine, done],
  );

  const waiting = useMemo(() => mine.filter((o) => isActive(o.status)).length, [mine]);
  const revenue = useMemo(
    () => mine.filter((o) => !isActive(o.status)).reduce((sum, o) => sum + o.total, 0),
    [mine],
  );

  return (
    <Screen testID="merchant-orders" padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-10">
        <View className="flex-row items-center gap-3 px-5 pb-3 pt-2">
          {onBack ? (
            <Pressable
              testID="merchant-orders-back"
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
              Commandes reçues
            </AppText>
            <AppText variant="caption" className="mt-0.5">
              {waiting > 0
                ? `${waiting} commande${waiting > 1 ? 's' : ''} à traiter.`
                : 'Rien en attente pour l’instant.'}
            </AppText>
          </View>
        </View>

        {/* Les deux seuls chiffres qui comptent derrière un comptoir. */}
        <View className="mx-5 flex-row gap-3">
          <View className="flex-1 rounded-card bg-surface-inverse p-4">
            <AppText className="font-display text-lime" style={{ fontSize: 22 }}>
              {waiting}
            </AppText>
            <AppText variant="caption" className="text-ink-inverse/60">
              à traiter
            </AppText>
          </View>
          <View className="flex-1 rounded-card border border-line bg-surface p-4">
            <AppText className="font-display text-ink" style={{ fontSize: 22 }}>
              {money(revenue)}
            </AppText>
            <AppText variant="caption" className="text-ink-faint">
              encaissé
            </AppText>
          </View>
        </View>

        <View className="mx-5 mt-4 flex-row gap-2">
          {(
            [
              { key: false, label: 'À traiter' },
              { key: true, label: 'Terminées' },
            ] as const
          ).map((f) => (
            <Pressable
              key={String(f.key)}
              testID={`merchant-orders-filter-${f.key ? 'done' : 'active'}`}
              accessibilityRole="button"
              accessibilityState={{ selected: done === f.key }}
              accessibilityLabel={f.label}
              onPress={() => setDone(f.key)}
              className={cn(
                'rounded-pill px-4 py-2',
                done === f.key ? 'bg-brand-500' : 'bg-surface-muted',
              )}
            >
              <AppText
                className={cn(
                  'font-sans-semibold',
                  done === f.key ? 'text-ink-inverse' : 'text-ink-muted',
                )}
                style={{ fontSize: 13 }}
              >
                {f.label}
              </AppText>
            </Pressable>
          ))}
        </View>

        {shown.length === 0 ? (
          <View testID="merchant-orders-empty" className="mt-10 items-center gap-2 px-10">
            <Feather name="inbox" size={30} color={colors.inkFaint} />
            <AppText variant="title" className="mt-1 text-center text-base">
              {done ? 'Aucune commande terminée' : 'Aucune commande en attente'}
            </AppText>
            <AppText variant="caption" className="text-center">
              {mine.length === 0
                ? 'Les commandes portant sur vos ventes flash arriveront ici. Publiez une offre, puis commandez-la depuis l’accueil pour voir le parcours complet.'
                : 'Tout est traité.'}
            </AppText>
          </View>
        ) : (
          <View className="mt-4 gap-3 px-5">
            {shown.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onAdvance={(status) => setOrderStatus(order.id, status)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function OrderCard({
  order,
  onAdvance,
}: {
  order: Order;
  onAdvance: (status: OrderStatus) => void;
}) {
  const options = nextStatuses(order.status, order.fulfilment);
  const tone = toneOf(order.status);

  return (
    <View
      testID={`merchant-order-${order.id}`}
      className="overflow-hidden rounded-card border border-line bg-surface p-4"
    >
      <View className="flex-row items-start gap-2">
        <View className="flex-1">
          <AppText className="font-sans-bold text-ink">
            {order.items.reduce((n, l) => n + l.qty, 0)} article
            {order.items.reduce((n, l) => n + l.qty, 0) > 1 ? 's' : ''} · {money(order.total)}
          </AppText>
          <AppText variant="caption" className="mt-0.5 text-ink-faint">
            {FULFILMENT_LABEL[order.fulfilment]} · commande {order.id.slice(0, 6).toUpperCase()}
          </AppText>
        </View>
        <View className={cn('rounded-pill px-2.5 py-1', tone.split(' ')[0])}>
          <AppText className={cn('font-sans-bold', tone.split(' ')[1])} style={{ fontSize: 10 }}>
            {ORDER_STATUS_LABEL[order.status].toUpperCase()}
          </AppText>
        </View>
      </View>

      <View className="mt-2.5 gap-1 border-t border-line pt-2.5">
        {order.items.map((line) => (
          <View key={line.dealId} className="flex-row items-center gap-2">
            <AppText style={{ fontSize: 14 }}>{line.emoji}</AppText>
            <AppText className="flex-1 text-ink-muted" style={{ fontSize: 13 }} numberOfLines={1}>
              {line.title}
            </AppText>
            <AppText className="font-sans-semibold text-ink" style={{ fontSize: 13 }}>
              ×{line.qty}
            </AppText>
          </View>
        ))}
      </View>

      {/* Le geste suivant. Les transitions viennent de la machine à états du
          §11 : on ne propose jamais un chemin illégal. */}
      {options.length > 0 ? (
        <View className="mt-3 flex-row flex-wrap gap-2">
          {options.map((status, index) => {
            // La machine à états liste le chemin nominal EN TÊTE. Tout le
            // reste — refuser, rembourser — est une sortie de route : la
            // mettre en avant inviterait à la prendre, même quand c'est la
            // seule action restante sur une commande déjà close.
            const secondary = index > 0 || status === 'annulee' || status === 'remboursee';
            return (
              <Pressable
                key={status}
                testID={`merchant-order-${order.id}-${status}`}
                accessibilityRole="button"
                accessibilityLabel={ACTION_LABEL[status] ?? ORDER_STATUS_LABEL[status]}
                onPress={() => onAdvance(status)}
                className={cn(
                  'rounded-control px-4 py-2.5',
                  secondary ? 'border border-line' : 'bg-brand-500 active:bg-brand-600',
                )}
              >
                <AppText
                  className={cn(
                    'font-sans-bold',
                    secondary ? 'text-ink-muted' : 'text-ink-inverse',
                  )}
                  style={{ fontSize: 13 }}
                >
                  {ACTION_LABEL[status] ?? ORDER_STATUS_LABEL[status]}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
