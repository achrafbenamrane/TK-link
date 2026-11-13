import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText, Screen } from '@/shared/ui';
import { BackButton } from '@/shared/ui/back-button';
import { useColors } from '@/shared/theme/theme-provider';

import { canTransition } from '../lib/order-status';
import { orderRef } from '../lib/order-summary';
import { getDeal, getMerchant } from '../model/catalog';
import { useShopStore } from '../model/store';

type Props = {
  orderId: string;
  onBack: () => void;
};

const clock = (ms: number) => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
};

/**
 * « REMISE AU COURSIER » — l'écran du commerçant quand une commande en livraison part.
 *
 * Depuis le 13/11/2026, TK LINK n'a plus de livreurs à lui : la course est confiée à un coursier
 * partenaire (Uber Direct). Plus d'identité de livreur, de véhicule ni d'empreinte à vérifier ici :
 * le commerçant remet la commande, et elle passe « En livraison ». La suite (suivi, « Livrée »)
 * viendra du partenaire.
 *
 * Étapes : Commande prête → Remise au coursier → En livraison.
 */
export function HandoverScreen({ orderId }: Props) {
  const colors = useColors();
  const order = useShopStore((s) => s.orders.find((o) => o.id === orderId));
  const setOrderStatus = useShopStore((s) => s.setOrderStatus);
  const reportIssue = useShopStore((s) => s.reportIssue);

  const [handedAt, setHandedAt] = useState<number | null>(null);

  if (!order) {
    return (
      <Screen testID="handover-screen">
        <BackButton fallbackHref="/commandes" />
        <AppText variant="title" className="mt-6 text-center">
          Commande introuvable
        </AppText>
      </Screen>
    );
  }

  const deal = order.items[0] ? getDeal(order.items[0].dealId) : undefined;
  const merchant = deal ? getMerchant(deal.merchantId) : undefined;
  const articles = order.items.reduce((n, l) => n + l.qty, 0);
  const done = handedAt !== null || order.status === 'en_livraison' || order.status === 'livree';
  // La machine à états tranche : seule une commande en livraison, prête, peut partir.
  const canHand = !done && canTransition(order.status, 'en_livraison', order.fulfilment);
  const step = done ? 3 : 2;

  const hand = () => {
    if (!canHand) return;
    const res = setOrderStatus(order.id, 'en_livraison');
    // On n'annonce « remise » que si la machine à états l'a actée.
    if (res.ok) setHandedAt(Date.now());
  };

  const steps = [
    { n: 1, label: 'Commande prête' },
    { n: 2, label: 'Remise au coursier' },
    { n: 3, label: 'En livraison' },
  ];

  return (
    <Screen testID="handover-screen" padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-3 px-5 pb-10">
        <View className="gap-1 pt-2">
          <BackButton fallbackHref="/commandes" />
          <AppText variant="display" className="text-2xl">
            Remise au coursier
          </AppText>
        </View>

        {/* Étapes */}
        <View className="flex-row items-start" testID="handover-steps">
          {steps.map((s, i) => {
            const reached = s.n <= step;
            const active = s.n === step;
            return (
              <View key={s.n} className="flex-1 items-center gap-1">
                <View className="w-full flex-row items-center">
                  <View className={cn('h-0.5 flex-1', i === 0 ? 'bg-transparent' : 'bg-line')} />
                  <View
                    className={cn(
                      'h-7 w-7 items-center justify-center rounded-pill border',
                      reached ? 'border-brand-500 bg-brand-500' : 'border-line bg-surface-muted',
                    )}
                  >
                    <AppText
                      className={reached ? 'font-sans-bold text-white' : 'text-ink-muted'}
                      style={{ fontSize: 12 }}
                    >
                      {s.n}
                    </AppText>
                  </View>
                  <View
                    className={cn(
                      'h-0.5 flex-1',
                      i === steps.length - 1 ? 'bg-transparent' : 'bg-line',
                    )}
                  />
                </View>
                <AppText
                  className={active ? 'font-sans-bold text-brand-500' : 'text-ink-muted'}
                  style={{ fontSize: 11 }}
                >
                  {s.label}
                </AppText>
              </View>
            );
          })}
        </View>

        {/* La commande */}
        <View className="rounded-card border border-line bg-surface p-3.5">
          <View className="flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-control border border-brand-500 bg-brand-50">
              <Feather name="shopping-bag" size={20} color={colors.brand500} />
            </View>
            <View className="flex-1 gap-1">
              <AppText className="font-sans-bold text-ink">Commande {orderRef(order.id)}</AppText>
              <View className="flex-row items-center gap-4">
                <View className="flex-row items-center gap-1">
                  <Feather name="clock" size={12} color={colors.inkFaint} />
                  <AppText variant="caption">Aujourd’hui, {clock(order.createdAt)}</AppText>
                </View>
                <View className="flex-row items-center gap-1">
                  <Feather name="box" size={12} color={colors.inkFaint} />
                  <AppText variant="caption">
                    {articles} article{articles > 1 ? 's' : ''}
                  </AppText>
                </View>
              </View>
            </View>
          </View>
          <View className="mt-3 flex-row items-center gap-2.5 border-t border-dashed border-line pt-3">
            <Feather name="map-pin" size={16} color={colors.brand500} />
            <View className="flex-1">
              <AppText className="font-sans-semibold text-ink" style={{ fontSize: 13.5 }}>
                {merchant?.name ?? 'Commerçant'}
              </AppText>
              <AppText variant="caption" className="text-ink-faint">
                {merchant?.area ?? ''}
              </AppText>
            </View>
          </View>
        </View>

        {/* Le partenaire de livraison */}
        <View
          testID="handover-partner"
          className="flex-row items-center gap-3 rounded-card border border-line bg-surface p-3.5"
        >
          <View className="h-14 w-14 items-center justify-center rounded-pill border-2 border-brand-500 bg-surface-muted">
            <Feather name="truck" size={24} color={colors.inkMuted} />
          </View>
          <View className="flex-1 gap-0.5">
            <AppText className="font-sans-bold text-ink" style={{ fontSize: 16 }}>
              Coursier Uber Direct
            </AppText>
            <AppText variant="caption">
              Le coursier partenaire vient chercher la commande au comptoir : remettez-la-lui, puis
              confirmez ici.
            </AppText>
          </View>
        </View>

        {done ? (
          <View
            testID="handover-done"
            className="flex-row items-center gap-3 rounded-card border border-success bg-surface-muted p-3.5"
          >
            <View className="h-10 w-10 items-center justify-center rounded-pill bg-success">
              <Feather name="check" size={20} color="#FFFFFF" />
            </View>
            <View className="flex-1">
              <AppText className="font-sans-bold text-success">Remise au coursier</AppText>
              <AppText variant="caption" className="text-ink-faint">
                La commande est en livraison : le client peut la suivre.
              </AppText>
            </View>
            <AppText variant="caption" className="text-ink-muted">
              {handedAt ? clock(handedAt) : ''}
            </AppText>
          </View>
        ) : null}

        <Pressable
          testID="handover-confirm"
          accessibilityRole="button"
          accessibilityState={{ disabled: !canHand }}
          disabled={!canHand}
          onPress={hand}
          className={cn(
            'flex-row items-center justify-center gap-2.5 rounded-control bg-brand-500 py-4',
            !canHand && 'opacity-40',
          )}
        >
          <Feather name="box" size={18} color="#FFFFFF" />
          <AppText className="font-sans-bold text-white" style={{ fontSize: 16 }}>
            {done ? 'Commande remise' : 'Remettre au coursier'}
          </AppText>
        </Pressable>

        <Pressable
          testID="handover-report"
          accessibilityRole="button"
          onPress={() => {
            reportIssue(order.id, 'autre');
            Alert.alert('Signalement transmis', 'Le support TK LINK a été prévenu.');
          }}
          className="flex-row items-center justify-center gap-2 rounded-control border border-brand-500 py-3.5"
        >
          <Feather name="alert-triangle" size={15} color={colors.brand500} />
          <AppText className="font-sans-semibold text-brand-600" style={{ fontSize: 14 }}>
            Signaler un problème
          </AppText>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
