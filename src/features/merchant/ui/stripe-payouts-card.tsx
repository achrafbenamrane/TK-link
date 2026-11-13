import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { formatEuros } from '@/shared/lib/money';
import { AppText } from '@/shared/ui';

import { fetchStripePayouts, type StripePayouts } from '../lib/payments-api';

const STATUS_LABEL: Record<StripePayouts['payouts'][number]['status'], string> = {
  paid: 'Versé',
  pending: 'Prévu',
  in_transit: 'En route',
  canceled: 'Annulé',
  failed: 'Échoué',
};

function day(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/**
 * « CHEZ STRIPE » — ce que Stripe dit du compte du commerce : le solde disponible, ce qui est en
 * attente, et les derniers virements vers sa banque, avec leurs dates (V1.1, Commerçant > Flux
 * finance : TK LINK expose les données du PSP, sans moteur de trésorerie propre).
 *
 * Relu à chaque passage sur l'écran. Rien ne s'affiche tant que Stripe ne répond pas (clés pas
 * encore posées, commerce pas encore inscrit) : l'écran garde alors son estimation, sans message
 * d'erreur de plus — la carte d'inscription, au-dessus, dit déjà ce qu'il reste à faire.
 */
export function StripePayoutsCard() {
  const [data, setData] = useState<StripePayouts | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void fetchStripePayouts().then((res) => {
        if (alive && res.ok) setData(res.value);
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  if (!data) return null;
  return (
    <View
      testID="stripe-payouts"
      className="mb-4 gap-3 rounded-card border border-line bg-surface-muted p-4"
    >
      <AppText variant="label">Chez Stripe</AppText>
      <View className="flex-row gap-3">
        <View className="flex-1 gap-0.5">
          <AppText variant="caption">Disponible</AppText>
          <AppText testID="stripe-available" className="font-display text-xl text-ink">
            {formatEuros(data.availableCents / 100)}
          </AppText>
        </View>
        <View className="flex-1 gap-0.5">
          <AppText variant="caption">En attente</AppText>
          <AppText testID="stripe-pending" className="font-display text-xl text-ink-muted">
            {formatEuros(data.pendingCents / 100)}
          </AppText>
        </View>
      </View>

      <View className="gap-2 border-t border-line pt-3">
        <AppText variant="caption" className="font-sans-semibold text-ink-muted">
          Virements vers votre banque
        </AppText>
        {data.payouts.length === 0 ? (
          <AppText testID="stripe-payouts-empty" variant="caption" className="text-ink-faint">
            Aucun virement pour l’instant : Stripe vire selon le calendrier de votre compte.
          </AppText>
        ) : (
          data.payouts.map((p) => (
            <View
              key={p.id}
              testID={`stripe-payout-${p.id}`}
              className="flex-row items-center justify-between gap-3"
            >
              <AppText variant="caption" className="text-ink-muted">
                {`${day(p.arrivalDate)} · ${STATUS_LABEL[p.status]}`}
              </AppText>
              <AppText className="font-sans-semibold text-sm text-ink">
                {formatEuros(p.amountCents / 100)}
              </AppText>
            </View>
          ))
        )}
      </View>
    </View>
  );
}
