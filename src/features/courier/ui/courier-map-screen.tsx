import { Feather } from '@expo/vector-icons';
import { ScrollView, View } from 'react-native';

import { AppText, Button, RouteMap, Screen } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

import { DEMO_MISSIONS } from '../lib/demo';
import { useCourierStore, type Mission } from '../model/store';
import { CourierHeader } from './parts';

type Props = {
  /** Les missions proposées — pour montrer la prochaine quand aucune n'est en cours. */
  missions: Mission[];
  showExamples?: boolean;
  /** Ouvre l'onglet Missions. */
  onOpenMissions: () => void;
};

/**
 * L'ONGLET « CARTE » du livreur : la course en cours, du commerce au client ; à défaut, la
 * prochaine mission proposée. Pas de position inventée : la carte ne montre que ce que la mission
 * sait (adresses géolocalisées).
 */
export function CourierMapScreen({ missions, showExamples = false, onOpenMissions }: Props) {
  const colors = useColors();
  const active = useCourierStore((s) => s.active);
  const declined = useCourierStore((s) => s.declined);
  const online = useCourierStore((s) => s.online);

  const offers = (showExamples ? [...missions, ...DEMO_MISSIONS] : missions).filter(
    (m) => !declined.includes(m.orderId),
  );
  // La carte a besoin d'adresses géolocalisées : on montre la première mission qui en a.
  const mission =
    active?.mission ??
    (online ? (offers.find((m) => m.pickupGeo && m.dropoffGeo) ?? offers[0]) : undefined);

  return (
    <Screen testID="courier-map-screen" padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-3 px-5 pb-28">
        <CourierHeader title="Carte" badge={active ? 'Mission en cours' : undefined} />

        {mission?.pickupGeo && mission.dropoffGeo ? (
          <RouteMap
            testID="courier-map"
            from={{ ...mission.pickupGeo, label: mission.merchantName }}
            to={{ ...mission.dropoffGeo, label: mission.clientName ?? 'Client' }}
            height={320}
          />
        ) : (
          <View
            testID="courier-map-empty"
            className="items-center gap-2 rounded-card border border-line bg-surface-muted px-8 py-16"
          >
            <Feather name="map" size={30} color={colors.inkFaint} />
            <AppText variant="caption" className="text-center">
              {online
                ? 'Aucune course à afficher. La carte montre le trajet dès qu’une mission est acceptée.'
                : 'Passez disponible pour voir les missions autour de vous.'}
            </AppText>
          </View>
        )}

        {mission ? (
          <View className="gap-2 rounded-card border border-line bg-surface p-4">
            <AppText variant="caption" className="font-sans-semibold text-ink-muted">
              {active ? 'Mission en cours' : 'Prochaine mission proposée'}
            </AppText>
            <AppText className="font-sans-bold text-ink">{mission.merchantName}</AppText>
            <AppText variant="caption" className="text-ink-faint">
              {mission.merchantArea ? `${mission.merchantArea} → ` : ''}
              {mission.dropoff}
            </AppText>
            <View className="flex-row gap-5">
              <AppText variant="caption" className="text-ink">
                {mission.distanceKm !== null
                  ? `${mission.distanceKm.toFixed(1).replace('.', ',')} km`
                  : '—'}
              </AppText>
              <AppText variant="caption" className="text-ink">
                {mission.etaMin ? `${mission.etaMin} min` : '—'}
              </AppText>
            </View>
          </View>
        ) : null}

        <Button
          testID="courier-map-open-missions"
          label={active ? 'Voir la mission' : 'Voir les missions'}
          variant="secondary"
          onPress={onOpenMissions}
        />
      </ScrollView>
    </Screen>
  );
}
