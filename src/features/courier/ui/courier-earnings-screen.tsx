import { Feather } from '@expo/vector-icons';
import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';

import { PLATFORM_SETTINGS } from '@/shared/lib/platform-settings';
import { AppText, Screen } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

import { formatEur } from '../lib/courier';
import { selectHistory, useCourierStore } from '../model/store';

/**
 * LE PORTEFEUILLE DE REVENUS ET L'HISTORIQUE — CDC V1.1, Livreur > Flux finance :
 * « portefeuille de revenus et historique consultables par le livreur ».
 *
 * Les montants sont le forfait de 3,00 € par commande ; la majoration kilométrique
 * (0,80 €/km au-delà de la zone de base) n'est comptée que quand la zone de base
 * ET la distance sont connues. Sinon l'écran le dit, au lieu d'afficher un total
 * qui aurait l'air complet sans l'être.
 */
export function CourierEarningsScreen() {
  const colors = useColors();
  const history = useCourierStore(selectHistory);

  const total = useMemo(() => history.reduce((s, d) => s + d.gainEur, 0), [history]);
  const partial = history.some((d) => !d.gainComplet);

  return (
    <Screen testID="courier-earnings-screen" padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-4 px-5 pb-10">
        <View className="pt-3">
          <AppText variant="display" className="text-2xl">
            Mes revenus
          </AppText>
        </View>

        <View className="gap-1 rounded-card bg-surface-inverse p-5">
          <AppText variant="caption" className="text-ink-inverse/70">
            Gains cumulés
          </AppText>
          <AppText
            testID="courier-total"
            className="font-display text-ink-inverse"
            style={{ fontSize: 34, fontVariant: ['tabular-nums'] }}
          >
            {formatEur(total)}
          </AppText>
          <AppText variant="caption" className="text-ink-inverse/70">
            {history.length} course{history.length > 1 ? 's' : ''} livrée
            {history.length > 1 ? 's' : ''}
          </AppText>
        </View>

        {partial ? (
          <View
            testID="courier-partial-note"
            className="flex-row items-start gap-2.5 rounded-card bg-surface-muted p-3.5"
          >
            <Feather name="info" size={15} color={colors.inkFaint} />
            <AppText variant="caption" className="flex-1 text-ink-muted">
              Ces montants sont le forfait de {formatEur(PLATFORM_SETTINGS.courierBaseFeeEur)} par
              commande. La majoration de {formatEur(PLATFORM_SETTINGS.courierPerKmEur)}/km au-delà
              de la zone de base s’y ajoutera dès que cette zone sera définie.
            </AppText>
          </View>
        ) : null}

        <View className="gap-2">
          <AppText variant="label">Historique</AppText>
          {history.length === 0 ? (
            <View testID="courier-history-empty" className="items-center gap-2 py-10">
              <Feather name="clock" size={26} color={colors.inkFaint} />
              <AppText variant="caption">Aucune course livrée pour le moment.</AppText>
            </View>
          ) : (
            history.map((d) => (
              <View
                key={`${d.orderId}-${d.at}`}
                testID={`courier-history-${d.orderId}`}
                className="flex-row items-center gap-3 rounded-card border border-line bg-surface p-3.5"
              >
                <View className="flex-1">
                  <AppText className="font-sans-semibold text-ink" numberOfLines={1}>
                    {d.merchantName}
                  </AppText>
                  <AppText variant="caption" className="text-ink-faint">
                    {new Date(d.at).toLocaleDateString('fr-FR')}
                    {d.distanceKm !== null
                      ? ` · ${d.distanceKm.toFixed(1).replace('.', ',')} km`
                      : ''}
                  </AppText>
                </View>
                <AppText
                  className="font-sans-bold text-ink"
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  {formatEur(d.gainEur)}
                </AppText>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
