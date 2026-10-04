import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { AppText, Screen } from '@/shared/ui';
import { BackButton } from '@/shared/ui/back-button';

import { commissionCents, COMMISSION_PCT, formatCents, netCents } from '../lib/billing';
import { liveOffers } from '../lib/offers';
import { selectOffers, useMerchantStore } from '../model/store';

type Props = {
  /** Montants des commandes honorées, en centimes — fournis par la route. */
  honouredTotalsCents: number[];
  /** Nombre de commandes reçues, toutes confondues. */
  ordersCount: number;
};

/**
 * LES STATISTIQUES du commerçant — la tuile de la maquette.
 *
 * Que des chiffres RÉELS : ses Flash publiés, ses commandes, ce qu'il a encaissé
 * et la commission de 5 % (CDC V1.1). Pas de « clients fidélisés » ni de courbes :
 * sans serveur, l'app ne les connaît pas, et un chiffre inventé ment à celui qui
 * pilote son commerce.
 */
export function MerchantStatsScreen({ honouredTotalsCents, ordersCount }: Props) {
  const offers = useMerchantStore(selectOffers);
  // Instant figé au montage : pas d'horloge pendant le rendu.
  const [now] = useState(() => Date.now());

  const { gross, commission, net } = useMemo(() => {
    const total = honouredTotalsCents.reduce((s, c) => s + c, 0);
    return { gross: total, commission: commissionCents(total), net: netCents(total) };
  }, [honouredTotalsCents]);

  const live = liveOffers(offers, now).length;

  const cards: { id: string; label: string; value: string }[] = [
    { id: 'flash-published', label: 'Flash publiés', value: String(offers.length) },
    { id: 'flash-live', label: 'Flash en cours', value: String(live) },
    { id: 'orders', label: 'Commandes reçues', value: String(ordersCount) },
    { id: 'honoured', label: 'Commandes honorées', value: String(honouredTotalsCents.length) },
  ];

  return (
    <Screen testID="merchant-stats-screen" padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-4 px-5 pb-10">
        <View className="gap-1 pt-2">
          <BackButton fallbackHref="/" />
          <AppText variant="display" className="text-2xl">
            Statistiques
          </AppText>
        </View>

        <View className="flex-row flex-wrap gap-3">
          {cards.map((c) => (
            <View
              key={c.id}
              testID={`stats-${c.id}`}
              className="min-w-[46%] flex-1 gap-0.5 rounded-card border border-line bg-surface p-4"
            >
              <AppText className="font-display text-ink" style={{ fontSize: 26 }}>
                {c.value}
              </AppText>
              <AppText variant="caption" className="text-ink-faint">
                {c.label}
              </AppText>
            </View>
          ))}
        </View>

        <View className="gap-2 rounded-card bg-surface-inverse p-5">
          <AppText variant="caption" className="text-ink-inverse/70">
            Encaissé (commandes honorées)
          </AppText>
          <AppText
            testID="stats-gross"
            className="font-display text-ink-inverse"
            style={{ fontSize: 30 }}
          >
            {formatCents(gross)}
          </AppText>
          <View className="flex-row justify-between border-t border-ink-inverse/15 pt-2">
            <AppText variant="caption" className="text-ink-inverse/70">
              Commission TK LINK ({COMMISSION_PCT} %)
            </AppText>
            <AppText testID="stats-commission" className="font-sans-semibold text-ink-inverse">
              −{formatCents(commission)}
            </AppText>
          </View>
          <View className="flex-row justify-between">
            <AppText variant="caption" className="text-ink-inverse/70">
              Pour vous
            </AppText>
            <AppText testID="stats-net" className="font-sans-bold text-accent">
              {formatCents(net)}
            </AppText>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
