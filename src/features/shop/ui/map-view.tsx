import { Feather } from '@expo/vector-icons';
import Mapbox from '@rnmapbox/maps';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { getMerchant } from '../model/catalog';
import { useShopStore } from '../model/store';
import type { Category, Deal } from '../model/schema';
import { fetchRoute, routeToGeoJSON, type Route } from '../lib/directions';
import { formatDistance, TOULOUSE_CENTER } from '../lib/geo';
import { hasMapboxToken, MAPBOX_PUBLIC_TOKEN } from '../lib/mapbox';

Mapbox.setAccessToken(MAPBOX_PUBLIC_TOKEN);

type Props = {
  /** Déjà filtrés par catégorie + recherche — la carte n'est qu'un rendu. */
  deals: Deal[];
  category: Category | null;
};

/** Bulle de prix : l'affordance de la carte. Rouge = sélectionnée. */
function PriceBubble({ deal, active }: { deal: Deal; active: boolean }) {
  return (
    <View className="items-center">
      <View
        className={cn(
          'flex-row items-center gap-1 rounded-pill border px-2.5 py-1.5',
          active ? 'border-brand-600 bg-brand-500' : 'border-line bg-surface',
        )}
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.18,
          shadowRadius: 6,
          elevation: 4,
        }}
      >
        <AppText style={{ fontSize: 11 }}>{deal.emoji}</AppText>
        <AppText
          className={cn('font-sans-bold', active ? 'text-ink-inverse' : 'text-ink')}
          style={{ fontSize: 12 }}
        >
          {deal.price.toFixed(2)}€
        </AppText>
      </View>
      {/* petite pointe sous la bulle */}
      <View
        className={cn('-mt-0.5 h-1.5 w-1.5 rotate-45', active ? 'bg-brand-500' : 'bg-surface')}
      />
    </View>
  );
}

export function DealsMap({ deals, category }: Props) {
  const router = useRouter();
  const cameraRef = useRef<Mapbox.Camera>(null);

  // Position partagée : demandée une seule fois par HomeScreen. Sans position,
  // la carte s'affiche quand même, centrée sur Toulouse.
  const me = useShopStore((s) => s.userCoord);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [routing, setRouting] = useState(false);

  // Un changement de filtre invalide la sélection : garder une route vers une
  // bulle qui vient de disparaître n'aurait aucun sens.
  useEffect(() => {
    setSelectedId(null);
    setRoute(null);
  }, [category]);

  const selected = useMemo(
    () => deals.find((d) => d.id === selectedId) ?? null,
    [deals, selectedId],
  );

  const onSelect = async (deal: Deal) => {
    const merchant = getMerchant(deal.merchantId);
    if (!merchant) return;

    setSelectedId(deal.id);
    cameraRef.current?.setCamera({
      centerCoordinate: [merchant.coord.lng, merchant.coord.lat],
      zoomLevel: 14,
      animationDuration: 600,
    });

    const from = me ?? TOULOUSE_CENTER;
    setRouting(true);
    const r = await fetchRoute(from, merchant.coord);
    setRoute(r);
    setRouting(false);
  };

  if (!hasMapboxToken) {
    return (
      <View className="flex-1 items-center justify-center px-10" testID="map-no-token">
        <Feather name="map" size={30} color={colors.inkFaint} />
        <AppText variant="title" className="mt-3 text-center text-ink-faint">
          Carte indisponible
        </AppText>
        <AppText variant="caption" className="mt-1 text-center">
          Le jeton Mapbox n’est pas configuré pour ce build.
        </AppText>
      </View>
    );
  }

  const center = me ?? TOULOUSE_CENTER;
  const selectedMerchant = selected ? getMerchant(selected.merchantId) : null;

  return (
    <View className="flex-1" testID="deals-map">
      <Mapbox.MapView
        style={{ flex: 1 }}
        styleURL={Mapbox.StyleURL.Light}
        scaleBarEnabled={false}
        logoPosition={{ bottom: 96, left: 12 }}
        attributionPosition={{ bottom: 96, left: 92 }}
        onPress={() => {
          setSelectedId(null);
          setRoute(null);
        }}
      >
        <Mapbox.Camera
          ref={cameraRef}
          defaultSettings={{ centerCoordinate: [center.lng, center.lat], zoomLevel: 12.5 }}
        />
        {me ? <Mapbox.UserLocation visible androidRenderMode="normal" /> : null}

        {route ? (
          <Mapbox.ShapeSource id="route-source" shape={routeToGeoJSON(route)}>
            <Mapbox.LineLayer
              id="route-line"
              style={{
                lineColor: colors.brand500,
                lineWidth: 4.5,
                lineCap: 'round',
                lineJoin: 'round',
                // Pointillés quand c'est une ligne droite : on ne fait pas
                // passer une approximation pour un vrai trajet.
                lineDasharray: route.approximate ? [2, 2] : [1],
              }}
            />
          </Mapbox.ShapeSource>
        ) : null}

        {deals.map((deal) => {
          const merchant = getMerchant(deal.merchantId);
          if (!merchant) return null;
          return (
            <Mapbox.MarkerView
              key={deal.id}
              id={deal.id}
              coordinate={[merchant.coord.lng, merchant.coord.lat]}
              allowOverlap={false}
            >
              <Pressable
                testID={`bubble-${deal.id}`}
                accessibilityRole="button"
                accessibilityLabel={`${deal.title} chez ${merchant.name}, ${deal.price.toFixed(2)} euros`}
                onPress={() => onSelect(deal)}
              >
                <PriceBubble deal={deal} active={deal.id === selectedId} />
              </Pressable>
            </Mapbox.MarkerView>
          );
        })}
      </Mapbox.MapView>

      {/* Carte de détail — remonte l'essentiel sans quitter la carte. */}
      {selected && selectedMerchant ? (
        <View className="absolute inset-x-4 bottom-4" testID="map-detail-card">
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/produit/${selected.id}`)}
            className="flex-row items-center gap-3 rounded-card border border-line bg-surface p-3"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.16,
              shadowRadius: 16,
              elevation: 8,
            }}
          >
            <View
              className="h-16 w-16 items-center justify-center rounded-control"
              style={{ backgroundColor: selected.tint }}
            >
              <AppText style={{ fontSize: 34, lineHeight: 42 }}>{selected.emoji}</AppText>
            </View>
            <View className="flex-1 gap-0.5">
              <AppText variant="caption" className="font-sans-medium text-ink-muted">
                {selectedMerchant.name} · {selectedMerchant.area}
              </AppText>
              <AppText variant="title" className="text-base" numberOfLines={1}>
                {selected.title}
              </AppText>
              <View className="flex-row items-center gap-2">
                <AppText className="font-display text-base text-ink">
                  {selected.price.toFixed(2)}€
                </AppText>
                {routing ? (
                  <ActivityIndicator size="small" color={colors.inkFaint} />
                ) : route ? (
                  <View className="flex-row items-center gap-1">
                    <Feather name="navigation" size={11} color={colors.brand500} />
                    <AppText variant="caption" className="text-ink-muted">
                      {formatDistance(route.km)} · {route.minutes} min
                      {route.approximate ? ' (approx.)' : ''}
                    </AppText>
                  </View>
                ) : null}
              </View>
            </View>
            <Feather name="chevron-right" size={20} color={colors.inkFaint} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
