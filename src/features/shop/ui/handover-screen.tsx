import { Feather, Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText, Screen } from '@/shared/ui';
import { BackButton } from '@/shared/ui/back-button';
import { useColors } from '@/shared/theme/theme-provider';

import { getDeal, getMerchant } from '../model/catalog';
import { useShopStore } from '../model/store';

export type HandoverCourier = {
  name: string;
  vehicle: string;
  verified: boolean;
  present: boolean;
};

type Props = {
  orderId: string;
  /** Le livreur qui se présente — fourni par la route (feature `courier`). */
  courier: HandoverCourier;
  onBack: () => void;
};

const clock = (ms: number) => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
};

/**
 * « VALIDATION LIVREUR » — l'écran du commerçant au moment de la remise, tel que
 * le client l'a dessiné : étapes Commande prête → Remise au livreur → Terminée, la
 * commande, le livreur (véhicule, compte vérifié, présent), et la validation
 * biométrique faite SUR L'APPAREIL DU LIVREUR (V1.1 : biométrie locale).
 *
 * Le commerçant ne manipule aucune empreinte : il voit le résultat. Ici, sans
 * serveur ni second téléphone, un geste simule la pose du doigt du livreur.
 */
export function HandoverScreen({ orderId, courier, onBack }: Props) {
  const colors = useColors();
  const order = useShopStore((s) => s.orders.find((o) => o.id === orderId));
  const setOrderStatus = useShopStore((s) => s.setOrderStatus);
  const reportIssue = useShopStore((s) => s.reportIssue);

  const [arrivedAt] = useState(() => Date.now());
  const [validatedAt, setValidatedAt] = useState<number | null>(null);
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
  const step = done ? 3 : validatedAt ? 2 : 2;

  const hand = () => {
    if (!validatedAt) return;
    setOrderStatus(order.id, 'en_livraison');
    setHandedAt(Date.now());
  };

  const steps = [
    { n: 1, label: 'Commande prête' },
    { n: 2, label: 'Remise au livreur' },
    { n: 3, label: 'Terminée' },
  ];

  return (
    <Screen testID="handover-screen" padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-3 px-5 pb-10">
        <View className="gap-1 pt-2">
          <BackButton fallbackHref="/commandes" />
          <AppText variant="display" className="text-2xl">
            Validation livreur
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
              <AppText className="font-sans-bold text-ink">
                Commande #{order.id.slice(0, 6).toUpperCase()}
              </AppText>
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

        {/* Le livreur */}
        <View className="flex-row items-center gap-3 rounded-card border border-line bg-surface p-3.5">
          <View className="h-14 w-14 items-center justify-center rounded-pill border-2 border-brand-500 bg-surface-muted">
            <Feather name="user" size={24} color={colors.inkMuted} />
          </View>
          <View className="flex-1 gap-0.5">
            <AppText className="font-sans-bold text-ink" style={{ fontSize: 16 }}>
              {courier.name}
            </AppText>
            <View className="flex-row items-center gap-1.5">
              <Feather name="navigation" size={12} color={colors.inkFaint} />
              <AppText variant="caption">{courier.vehicle}</AppText>
            </View>
            {courier.verified ? (
              <View className="flex-row items-center gap-1">
                <Feather name="shield" size={12} color={colors.accentDeep} />
                <AppText variant="caption" className="text-accent-deep">
                  Compte vérifié
                </AppText>
              </View>
            ) : null}
          </View>
          {courier.present ? (
            <View className="rounded-control border border-success px-2.5 py-1">
              <AppText className="font-sans-semibold text-success" style={{ fontSize: 11.5 }}>
                Présent
              </AppText>
            </View>
          ) : null}
        </View>

        {/* Validation biométrique — faite sur l'appareil du livreur */}
        <Pressable
          testID="handover-biometric"
          accessibilityRole="button"
          accessibilityLabel="Simuler la pose du doigt du livreur"
          disabled={validatedAt !== null || done}
          onPress={() => setValidatedAt(Date.now())}
          className="items-center gap-3 rounded-card border border-brand-500 bg-surface-muted px-4 py-5"
        >
          <View className="h-36 w-36 items-center justify-center rounded-pill border border-brand-200 bg-brand-50">
            <View className="h-28 w-28 items-center justify-center rounded-pill border-2 border-brand-500">
              <Ionicons name="finger-print" size={64} color={colors.brand500} />
            </View>
          </View>
          <AppText className="font-sans-bold text-ink" style={{ fontSize: 16 }}>
            Validation automatique
          </AppText>
          <AppText variant="caption" className="text-center">
            Le livreur pose son doigt sur son appareil. Si l’identité est confirmée, la remise du
            colis est validée automatiquement.
          </AppText>
          {validatedAt === null && !done ? (
            <AppText variant="caption" className="text-brand-600" style={{ fontSize: 11.5 }}>
              Démo — touchez pour simuler la pose du doigt
            </AppText>
          ) : null}
        </Pressable>

        {validatedAt !== null || done ? (
          <View
            testID="handover-validated"
            className="flex-row items-center gap-3 rounded-card border border-success bg-surface-muted p-3.5"
          >
            <View className="h-10 w-10 items-center justify-center rounded-pill bg-success">
              <Feather name="check" size={20} color="#FFFFFF" />
            </View>
            <View className="flex-1">
              <AppText className="font-sans-bold text-success">Identité validée</AppText>
              <AppText variant="caption" className="text-ink-faint">
                Livreur autorisé à récupérer le colis.
              </AppText>
            </View>
            <AppText variant="caption" className="text-ink-muted">
              {validatedAt ? clock(validatedAt) : ''}
            </AppText>
          </View>
        ) : null}

        <Pressable
          testID="handover-confirm"
          accessibilityRole="button"
          accessibilityState={{ disabled: validatedAt === null || done }}
          disabled={validatedAt === null || done}
          onPress={hand}
          className={cn(
            'flex-row items-center justify-center gap-2.5 rounded-control bg-brand-500 py-4',
            (validatedAt === null || done) && 'opacity-40',
          )}
        >
          <Feather name="box" size={18} color="#FFFFFF" />
          <AppText className="font-sans-bold text-white" style={{ fontSize: 16 }}>
            {done ? 'Colis remis' : 'Remettre le colis'}
          </AppText>
        </Pressable>

        {/* Traçabilité */}
        <View className="flex-row items-center justify-between rounded-card border border-line bg-surface p-3.5">
          {[
            { label: 'Livreur arrivé', at: arrivedAt, ok: true },
            { label: 'ID vérifiée', at: validatedAt, ok: validatedAt !== null },
            { label: 'Colis remis', at: handedAt, ok: handedAt !== null || done },
          ].map((t) => (
            <View key={t.label} className="flex-1 items-center gap-1">
              <View
                className={cn(
                  'h-6 w-6 items-center justify-center rounded-pill',
                  t.ok ? 'bg-success' : 'border border-line bg-surface-muted',
                )}
              >
                {t.ok ? <Feather name="check" size={13} color="#FFFFFF" /> : null}
              </View>
              <AppText className="text-ink" style={{ fontSize: 11 }}>
                {t.label}
              </AppText>
              <AppText variant="caption" className="text-ink-faint" style={{ fontSize: 10.5 }}>
                {t.at ? clock(t.at) : 'En attente'}
              </AppText>
            </View>
          ))}
        </View>

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
