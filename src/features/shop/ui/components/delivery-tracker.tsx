import { Feather } from '@expo/vector-icons';
import Mapbox from '@rnmapbox/maps';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AppText } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { fetchRoute, routeToGeoJSON, type Route } from '../../lib/directions';
import { geocodeAddress } from '../../lib/geocode';
import { courierPosition, deliveryProgress, minutesRemaining } from '../../lib/tracking';
import { getDeal, getMerchant } from '../../model/catalog';
import type { Address, Coord, Order } from '../../model/schema';

type Props = {
  order: Order;
  address: Address;
};

/**
 * Suivi de course : le trajet du commerçant jusqu'à chez vous, et le livreur
 * qui avance dessus.
 *
 * DÉMO — la position vient de `courierPosition`, interpolée sur le temps
 * écoulé. Le trajet et l'adresse, eux, sont réels : itinéraire routier Mapbox
 * et géocodage de l'adresse saisie. Quand le back-end enverra des positions,
 * seule la source du point change.
 */
export function DeliveryTracker({ order, address }: Props) {
  const cameraRef = useRef<Mapbox.Camera>(null);
  const [destination, setDestination] = useState<Coord | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);

  // Le départ, c'est le commerçant de la commande : on remonte offre → marchand
  // via le catalogue, les identifiants ne se déduisant pas l'un de l'autre.
  const merchant = useMemo(() => {
    for (const item of order.items) {
      const deal = getDeal(item.dealId);
      const m = deal ? getMerchant(deal.merchantId) : undefined;
      if (m) return m;
    }
    return undefined;
  }, [order.items]);

  const origin = merchant?.coord ?? null;

  // Géocodage de l'adresse, une fois.
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    geocodeAddress(address, controller.signal).then((coord) => {
      if (!alive) return;
      if (coord) setDestination(coord);
      else setFailed(true);
    });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [address]);

  // Itinéraire une fois les deux extrémités connues.
  useEffect(() => {
    if (!origin || !destination) return;
    let alive = true;
    fetchRoute(origin, destination).then((r) => {
      if (alive) setRoute(r);
    });
  }, [origin, destination]);

  // Le livreur avance : on redessine régulièrement tant que l'écran est ouvert.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 3000);
    return () => clearInterval(t);
  }, []);

  const line = useMemo<Coord[]>(
    () => route?.coordinates.map(([lng, lat]) => ({ lat, lng })) ?? [],
    [route],
  );
  const courier = useMemo(
    () => courierPosition(order, line),
    // `tick` est la dépendance qui fait avancer le point dans le temps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [order, line, tick],
  );
  const progress = deliveryProgress(order);
  const eta = minutesRemaining(order);

  if (failed) {
    return (
      <View className="mb-4 flex-row items-center gap-2 rounded-card border border-line bg-surface-muted p-4">
        <Feather name="map-pin" size={15} color={colors.inkFaint} />
        <AppText variant="caption" className="flex-1 text-ink-faint">
          Suivi indisponible pour cette adresse.
        </AppText>
      </View>
    );
  }

  if (!route || !courier) {
    return (
      <View className="mb-4 h-56 items-center justify-center gap-2 rounded-card border border-line bg-surface-muted">
        <ActivityIndicator color={colors.brand500} />
        <AppText variant="caption" className="text-ink-faint">
          Localisation du livreur…
        </AppText>
      </View>
    );
  }

  return (
    <View className="mb-4 overflow-hidden rounded-card border border-line bg-surface">
      <View className="h-56">
        <Mapbox.MapView
          style={{ flex: 1 }}
          styleURL={Mapbox.StyleURL.Light}
          // TextureView : la SurfaceView d'Android se place en coordonnées
          // fenêtre et ignore la mise en page — elle déborderait de la carte.
          surfaceView={false}
          scaleBarEnabled={false}
          logoEnabled={false}
          attributionPosition={{ bottom: 8, right: 8 }}
        >
          <Mapbox.Camera
            ref={cameraRef}
            defaultSettings={{ centerCoordinate: [courier.lng, courier.lat], zoomLevel: 12 }}
          />

          <Mapbox.ShapeSource id="delivery-route" shape={routeToGeoJSON(route)}>
            <Mapbox.LineLayer
              id="delivery-line"
              style={{
                lineColor: colors.brand500,
                lineWidth: 4,
                lineCap: 'round',
                lineJoin: 'round',
                lineDasharray: route.approximate ? [2, 2] : [1],
              }}
            />
          </Mapbox.ShapeSource>

          <Mapbox.MarkerView id="courier" coordinate={[courier.lng, courier.lat]}>
            <View className="h-9 w-9 items-center justify-center rounded-pill border-2 border-surface bg-brand-500">
              <Feather name="truck" size={15} color={colors.inkInverse} />
            </View>
          </Mapbox.MarkerView>

          {destination ? (
            <Mapbox.MarkerView id="destination" coordinate={[destination.lng, destination.lat]}>
              <View className="h-7 w-7 items-center justify-center rounded-pill border-2 border-surface bg-ink">
                <Feather name="home" size={12} color={colors.inkInverse} />
              </View>
            </Mapbox.MarkerView>
          ) : null}
        </Mapbox.MapView>
      </View>

      <View className="gap-2 p-4">
        <View className="flex-row items-center justify-between">
          <AppText className="font-sans-bold text-ink">
            {progress >= 1 ? 'Livreur arrivé' : 'Votre livreur est en route'}
          </AppText>
          <AppText className="font-display text-ink" style={{ fontSize: 16, lineHeight: 21 }}>
            {progress >= 1 ? '—' : `${eta} min`}
          </AppText>
        </View>
        <View className="h-1.5 overflow-hidden rounded-pill bg-surface-sunken">
          <View
            className="h-full rounded-pill bg-brand-500"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </View>
        {merchant ? (
          <AppText variant="caption" className="text-xs text-ink-faint">
            Depuis {merchant.name} · vers {address.label}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}
