import { Feather } from '@expo/vector-icons';
import { Linking, Pressable, View } from 'react-native';

import { AppText, Button, RouteMap } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

import { useCourierStore, type Mission } from '../model/store';
import { CourierHeader, Panel } from './parts';

type Props = {
  mission: Mission;
  onArrive: () => void;
  onMessage: () => void;
  onIncident: () => void;
};

/**
 * NAVIGATION / SUIVI — la troisième maquette : l'itinéraire du commerce au client, l'heure
 * d'arrivée, la distance et le temps restant, la carte, puis appeler, écrire, signaler un
 * incident, et « J'arrive chez le client ».
 *
 * Les chiffres sont ceux de la mission : sans eux (course réelle sans coordonnées), on affiche
 * un tiret plutôt qu'un temps inventé.
 */
export function MissionNavigation({ mission, onArrive, onMessage, onIncident }: Props) {
  const colors = useColors();
  const vehicle = useCourierStore((s) => s.vehicle);
  const km =
    mission.distanceKm !== null ? `${mission.distanceKm.toFixed(1).replace('.', ',')} km` : '—';

  const openMaps = () => {
    if (!mission.dropoff) return;
    const destination = encodeURIComponent(mission.dropoff);
    // Vélo : à vélo ; scooter et voiture : en voiture.
    const mode = vehicle === 'velo' ? 'bicycling' : 'driving';
    void Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=${mode}`,
    ).catch(() => undefined);
  };

  const call = () => {
    if (!mission.clientPhone) return;
    void Linking.openURL(`tel:${mission.clientPhone.replace(/\s+/g, '')}`).catch(() => undefined);
  };

  return (
    <View testID="courier-navigation" className="gap-3">
      <CourierHeader title="Navigation" badge="En route client" />

      <Panel>
        <View className="flex-row items-center gap-3">
          <View className="items-center">
            <View className="h-3 w-3 rounded-pill border-2 border-brand-500" />
            <View className="h-7 w-px bg-line" />
            <View className="h-3 w-3 rounded-pill border-2 border-accent" />
          </View>
          <View className="flex-1 gap-3">
            <View>
              <AppText className="font-sans-semibold text-ink" style={{ fontSize: 13.5 }}>
                {mission.merchantName}
              </AppText>
              <AppText variant="caption" className="text-ink-faint" numberOfLines={1}>
                {mission.merchantArea}
              </AppText>
            </View>
            <View>
              <AppText className="font-sans-semibold text-ink" style={{ fontSize: 13.5 }}>
                {mission.clientName ?? 'Client'}
              </AppText>
              <AppText variant="caption" className="text-ink-faint" numberOfLines={1}>
                {mission.dropoff}
              </AppText>
            </View>
          </View>
          <Pressable
            testID="courier-open-maps"
            disabled={!mission.dropoff}
            accessibilityState={{ disabled: !mission.dropoff }}
            accessibilityRole="button"
            accessibilityLabel="Ouvrir l’itinéraire dans l’application de cartes"
            hitSlop={8}
            onPress={openMaps}
            className="h-10 w-10 items-center justify-center rounded-pill border border-accent"
          >
            <Feather name="navigation" size={17} color={colors.accent} />
          </Pressable>
        </View>
      </Panel>

      <View className="flex-row rounded-card border border-line bg-surface py-3">
        {[
          { id: 'eta', label: 'ETA', value: mission.targetTime ?? '—' },
          { id: 'distance', label: 'Distance', value: km },
          {
            id: 'left',
            label: 'Temps restant',
            value: mission.etaMin ? `${mission.etaMin} min` : '—',
          },
        ].map((c, i) => (
          <View
            key={c.id}
            testID={`courier-nav-${c.id}`}
            className={`flex-1 items-center gap-0.5 ${i > 0 ? 'border-l border-line' : ''}`}
          >
            <AppText variant="caption" className="text-ink-faint" style={{ fontSize: 10.5 }}>
              {c.label}
            </AppText>
            <AppText className="font-display text-ink" style={{ fontSize: 17 }}>
              {c.value}
            </AppText>
          </View>
        ))}
      </View>

      {mission.pickupGeo && mission.dropoffGeo ? (
        <RouteMap
          testID="courier-route-map"
          from={{ ...mission.pickupGeo, label: mission.merchantName }}
          to={{ ...mission.dropoffGeo, label: mission.clientName ?? 'Client' }}
          height={230}
        />
      ) : null}

      <View className="flex-row gap-2">
        {(
          [
            { key: 'call', label: 'Appeler', icon: 'phone', onPress: call },
            { key: 'message', label: 'Message', icon: 'message-square', onPress: onMessage },
            { key: 'incident', label: 'Incident', icon: 'alert-triangle', onPress: onIncident },
          ] as const
        ).map((a) => (
          <Pressable
            key={a.key}
            testID={`courier-nav-${a.key}`}
            accessibilityRole="button"
            accessibilityLabel={a.label}
            onPress={a.onPress}
            className="flex-1 items-center gap-1 rounded-card border border-line bg-surface py-3 active:opacity-70"
          >
            <Feather name={a.icon} size={19} color={colors.brand500} />
            <AppText className="text-ink" style={{ fontSize: 12 }}>
              {a.label}
            </AppText>
          </Pressable>
        ))}
      </View>

      <Button testID="courier-arrive" label="J’arrive chez le client" onPress={onArrive} />
    </View>
  );
}
