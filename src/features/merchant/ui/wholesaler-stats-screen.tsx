import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';

import { AppText, Screen } from '@/shared/ui';
import { BackButton } from '@/shared/ui/back-button';

import { commissionCents, COMMISSION_PCT, formatCents, netCents } from '../lib/billing';
import { selectOffers, selectWholesaleOrders, useMerchantStore } from '../model/store';

/**
 * LES STATISTIQUES B2B du grossiste — CDC V1.1, Grossiste > Process (EXIGENCE) : « statistiques
 * B2B tenues séparément des statistiques B2C ».
 *
 * Séparées parce qu'elles ne regardent QUE ses offres pro et les commandes des commerçants :
 * jamais un Flash vendu à un client. Que des chiffres réels, tirés de ce qu'il a publié et de
 * ce qui lui a été commandé ; la commission est celle de 5 % du CDC.
 */
export function WholesalerStatsScreen() {
  const offers = useMerchantStore(selectOffers).filter((o) => o.audience === 'commercants');
  const orders = useMerchantStore(selectWholesaleOrders);

  const { gross, byLot } = useMemo(() => {
    const total = orders.reduce((s, o) => s + o.totalCents, 0);
    const lots = new Map<string, { qty: number; cents: number }>();
    for (const o of orders) {
      const cur = lots.get(o.title) ?? { qty: 0, cents: 0 };
      lots.set(o.title, { qty: cur.qty + o.qty, cents: cur.cents + o.totalCents });
    }
    return {
      gross: total,
      byLot: [...lots.entries()].sort((a, b) => b[1].cents - a[1].cents),
    };
  }, [orders]);

  const delivered = orders.filter((o) => o.status === 'livree' || o.status === 'terminee').length;
  const cards = [
    { id: 'offers', label: 'Offres pro', value: String(offers.length) },
    { id: 'orders', label: 'Commandes reçues', value: String(orders.length) },
    { id: 'delivered', label: 'Commandes livrées', value: String(delivered) },
    { id: 'lots', label: 'Lots vendus', value: String(orders.reduce((s, o) => s + o.qty, 0)) },
  ];

  return (
    <Screen testID="wholesaler-stats-screen" padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-4 px-5 pb-10">
        <View className="gap-1 pt-2">
          <BackButton fallbackHref="/" />
          <AppText variant="display" className="text-2xl">
            Statistiques B2B
          </AppText>
          <AppText variant="caption">
            Vos offres pro et les commandes des commerçants — séparées de la vente aux clients.
          </AppText>
        </View>

        <View className="flex-row flex-wrap gap-3">
          {cards.map((c) => (
            <View
              key={c.id}
              testID={`b2b-stats-${c.id}`}
              className="min-w-[46%] flex-1 gap-0.5 rounded-card border border-line bg-surface p-4"
            >
              <AppText className="font-display text-ink" style={{ fontSize: 24 }}>
                {c.value}
              </AppText>
              <AppText variant="caption" className="text-ink-faint">
                {c.label}
              </AppText>
            </View>
          ))}
        </View>

        <View className="gap-2 rounded-card bg-surface-inverse p-4">
          <AppText className="font-display text-ink-inverse" style={{ fontSize: 15 }}>
            Chiffre d’affaires B2B
          </AppText>
          <View className="flex-row items-center justify-between">
            <AppText className="text-ink-inverse/70" style={{ fontSize: 13 }}>
              Brut
            </AppText>
            <AppText testID="b2b-stats-gross" className="font-sans-bold text-ink-inverse">
              {formatCents(gross)}
            </AppText>
          </View>
          <View className="flex-row items-center justify-between">
            <AppText className="text-ink-inverse/70" style={{ fontSize: 13 }}>
              Commission TK LINK ({COMMISSION_PCT} %)
            </AppText>
            <AppText className="font-sans-bold text-ink-inverse">
              − {formatCents(commissionCents(gross))}
            </AppText>
          </View>
          <View className="flex-row items-center justify-between border-t border-ink-inverse/15 pt-2">
            <AppText className="text-ink-inverse/70" style={{ fontSize: 13 }}>
              Net pour vous
            </AppText>
            <AppText testID="b2b-stats-net" className="font-sans-bold text-accent">
              {formatCents(netCents(gross))}
            </AppText>
          </View>
        </View>

        <View className="gap-2">
          <AppText variant="title" className="text-base">
            Par lot
          </AppText>
          {byLot.length === 0 ? (
            <AppText variant="caption" className="text-ink-faint">
              Aucune commande pour l’instant.
            </AppText>
          ) : (
            byLot.map(([title, v]) => (
              <View
                key={title}
                testID="b2b-stats-lot"
                className="flex-row items-center gap-2 rounded-card border border-line bg-surface-muted px-3.5 py-3"
              >
                <AppText className="flex-1 text-ink" style={{ fontSize: 13 }} numberOfLines={2}>
                  {title}
                </AppText>
                <AppText className="text-ink-muted" style={{ fontSize: 12 }}>
                  {v.qty} lot{v.qty > 1 ? 's' : ''}
                </AppText>
                <AppText className="font-sans-bold text-ink" style={{ fontSize: 13 }}>
                  {formatCents(v.cents)}
                </AppText>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
