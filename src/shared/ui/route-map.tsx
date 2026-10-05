import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import type MapboxModule from '@rnmapbox/maps';
import Constants from 'expo-constants';
import { useMemo, useState } from 'react';
import { Platform, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { useColors } from '@/shared/theme/theme-provider';

import { AppText } from './text';

export type RoutePoint = { lat: number; lng: number; label?: string };

export type RouteMapProps = {
  /** Le point de retrait (le commerçant). */
  from: RoutePoint;
  /** La destination (le client). */
  to: RoutePoint;
  /** Position actuelle du livreur, si on la connaît. */
  courier?: RoutePoint;
  height?: number;
  testID?: string;
};

type Mapbox = typeof MapboxModule;

const DEFAULT_HEIGHT = 220;
/** Largeur supposée avant la première mesure (et dans les tests, où rien n’est mesuré). */
const DEFAULT_WIDTH = 320;
const PADDING = 44;

/** Jeton Mapbox PUBLIC (pk.*), injecté au build par `app.config.ts` — voir `extra.mapboxPublicToken`. */
const MAPBOX_PUBLIC_TOKEN: string =
  (Constants.expoConfig?.extra?.mapboxPublicToken as string | undefined) ?? '';
const hasMapboxToken = MAPBOX_PUBLIC_TOKEN.startsWith('pk.');

let mapboxModule: Mapbox | null | undefined;

/**
 * `@rnmapbox/maps` est chargé à la demande, côté natif et avec un jeton seulement :
 * le bundle web et Jest ne l’embarquent jamais. Un échec de chargement (module natif
 * absent du build) renvoie `null` et l’appelant retombe sur le fond stylisé.
 */
function loadMapbox(): Mapbox | null {
  if (Platform.OS === 'web' || !hasMapboxToken) return null;
  if (mapboxModule !== undefined) return mapboxModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- why: chargement paresseux, natif seulement
    const mod = require('@rnmapbox/maps') as { default?: Mapbox } & Mapbox;
    const mapbox = mod.default ?? mod;
    mapbox.setAccessToken(MAPBOX_PUBLIC_TOKEN);
    mapboxModule = mapbox;
  } catch {
    mapboxModule = null;
  }
  return mapboxModule;
}

/** Projection linéaire (équirectangulaire, corrigée de la latitude) dans la boîte, avec marge. */
export function projectPoints(
  points: RoutePoint[],
  width: number,
  height: number,
  padding = PADDING,
): { x: number; y: number }[] {
  const meanLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
  const k = Math.cos((meanLat * Math.PI) / 180);
  const xs = points.map((p) => p.lng * k);
  const ys = points.map((p) => p.lat);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX;
  const spanY = Math.max(...ys) - minY;
  const innerW = Math.max(width - padding * 2, 1);
  const innerH = Math.max(height - padding * 2, 1);
  // Même échelle sur les deux axes (la carte ne se déforme pas) ; un seul point → centré.
  const scale =
    spanX === 0 && spanY === 0
      ? 0
      : Math.min(spanX === 0 ? Infinity : innerW / spanX, spanY === 0 ? Infinity : innerH / spanY);
  const offsetX = (width - spanX * scale) / 2;
  const offsetY = (height - spanY * scale) / 2;
  return points.map((_, i) => ({
    x: offsetX + (xs[i]! - minX) * scale,
    y: offsetY + (spanY - (ys[i]! - minY)) * scale,
  }));
}

type PinKind = 'from' | 'to' | 'courier';

/** Pastille ronde posée sur la carte : magasin, domicile ou livreur. */
function Pin({ kind, label, testID }: { kind: PinKind; label?: string; testID: string }) {
  const colors = useColors();
  if (kind === 'courier') {
    return (
      <View
        testID={testID}
        accessibilityLabel="Position du livreur"
        className="h-5 w-5 items-center justify-center rounded-pill border-2 border-surface bg-accent"
      />
    );
  }
  return (
    <View testID={testID} className="items-center">
      <View
        className={
          kind === 'from'
            ? 'h-9 w-9 items-center justify-center rounded-pill border-2 border-surface bg-surface-inverse'
            : 'h-9 w-9 items-center justify-center rounded-pill border-2 border-surface bg-brand-500'
        }
      >
        {kind === 'from' ? (
          <MaterialCommunityIcons name="storefront" size={18} color={colors.inkInverse} />
        ) : (
          <Feather name="home" size={17} color={colors.inkInverse} />
        )}
      </View>
      {label ? (
        <View className="mt-1 max-w-[140px] rounded-pill border border-line bg-surface px-2 py-0.5">
          <AppText numberOfLines={1} className="font-sans-medium text-ink" style={{ fontSize: 11 }}>
            {label}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const PIN_HALF = 18;

/** Fond stylisé : quadrillage de rues, tracé rose, marqueurs. Sans réseau ni jeton. */
function FallbackMap({
  from,
  to,
  courier,
  height,
  testID,
}: Required<Pick<RouteMapProps, 'height' | 'testID'>> &
  Pick<RouteMapProps, 'from' | 'to' | 'courier'>) {
  const colors = useColors();
  const [width, setWidth] = useState(DEFAULT_WIDTH);

  const pts = useMemo(
    () => projectPoints(courier ? [from, to, courier] : [from, to], width, height),
    [from, to, courier, width, height],
  );
  const [a, b, c] = pts as [
    { x: number; y: number },
    { x: number; y: number },
    { x: number; y: number } | undefined,
  ];

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0) setWidth((prev) => (prev === w ? prev : w));
  };

  // Rues : lignes régulières légèrement décalées + deux avenues obliques. Tout est
  // dérivé de la taille, donc le dessin est stable d’un rendu à l’autre.
  const streets = useMemo(() => {
    const cols = Math.max(3, Math.round(width / 70));
    const rows = Math.max(3, Math.round(height / 60));
    const lines: { x1: number; y1: number; x2: number; y2: number; major: boolean }[] = [];
    for (let i = 1; i < cols; i++) {
      const x = (width / cols) * i + (i % 2 === 0 ? 6 : -4);
      lines.push({ x1: x, y1: 0, x2: x + (i % 3) * 4 - 4, y2: height, major: i % 3 === 0 });
    }
    for (let j = 1; j < rows; j++) {
      const y = (height / rows) * j + (j % 2 === 0 ? -5 : 5);
      lines.push({ x1: 0, y1: y, x2: width, y2: y + (j % 3) * 5 - 5, major: j % 2 === 0 });
    }
    lines.push({ x1: 0, y1: height * 0.8, x2: width * 0.6, y2: 0, major: true });
    lines.push({ x1: width * 0.4, y1: height, x2: width, y2: height * 0.25, major: true });
    return lines;
  }, [width, height]);

  return (
    <View
      testID={testID}
      accessibilityLabel="Carte de l’itinéraire"
      onLayout={onLayout}
      style={{ height }}
      className="w-full overflow-hidden rounded-card border border-line bg-surface-muted"
    >
      <Svg width="100%" height={height} style={{ position: 'absolute' }}>
        {streets.map((l, i) => (
          <Line
            key={i}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            stroke={l.major ? colors.surfaceSunken : colors.line}
            strokeWidth={l.major ? 7 : 3}
            strokeLinecap="round"
          />
        ))}
        {/* Halo clair sous le tracé, comme une vraie carte, puis le tracé rose. */}
        <Polyline
          points={`${a.x},${a.y} ${b.x},${b.y}`}
          stroke={colors.surface}
          strokeWidth={9}
          strokeLinecap="round"
          fill="none"
        />
        <Polyline
          testID={`${testID}-route`}
          points={`${a.x},${a.y} ${b.x},${b.y}`}
          stroke={colors.brand500}
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Circle cx={a.x} cy={a.y} r={3} fill={colors.brand500} />
        <Circle cx={b.x} cy={b.y} r={3} fill={colors.brand500} />
      </Svg>

      <View
        pointerEvents="none"
        className="absolute"
        style={{ left: a.x - PIN_HALF, top: a.y - PIN_HALF }}
      >
        <Pin kind="from" label={from.label} testID={`${testID}-from`} />
      </View>
      <View
        pointerEvents="none"
        className="absolute"
        style={{ left: b.x - PIN_HALF, top: b.y - PIN_HALF }}
      >
        <Pin kind="to" label={to.label} testID={`${testID}-to`} />
      </View>
      {c ? (
        <View pointerEvents="none" className="absolute" style={{ left: c.x - 10, top: c.y - 10 }}>
          <Pin kind="courier" testID={`${testID}-courier`} />
        </View>
      ) : null}
    </View>
  );
}

function MapboxRoute({
  mapbox,
  from,
  to,
  courier,
  height,
  testID,
}: Required<Pick<RouteMapProps, 'height' | 'testID'>> &
  Pick<RouteMapProps, 'from' | 'to' | 'courier'> & { mapbox: Mapbox }) {
  const colors = useColors();
  const all = courier ? [from, to, courier] : [from, to];
  const lats = all.map((p) => p.lat);
  const lngs = all.map((p) => p.lng);
  // Marge minimale pour qu’un seul point (ou deux points confondus) ne donne pas une emprise nulle.
  const eps = 0.002;
  const ne: [number, number] = [Math.max(...lngs) + eps, Math.max(...lats) + eps];
  const sw: [number, number] = [Math.min(...lngs) - eps, Math.min(...lats) - eps];

  const line = {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'LineString' as const,
      coordinates: [
        [from.lng, from.lat],
        [to.lng, to.lat],
      ],
    },
  };

  const { MapView, Camera, ShapeSource, LineLayer, MarkerView, StyleURL } = mapbox;

  return (
    <View
      testID={testID}
      accessibilityLabel="Carte de l’itinéraire"
      style={{ height }}
      className="w-full overflow-hidden rounded-card border border-line bg-surface-muted"
    >
      <MapView
        style={{ flex: 1 }}
        styleURL={StyleURL.Light}
        scaleBarEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        <Camera
          bounds={{ ne, sw, paddingTop: 48, paddingBottom: 48, paddingLeft: 48, paddingRight: 48 }}
          animationDuration={0}
        />
        <ShapeSource id="route-map-source" shape={line}>
          <LineLayer
            id="route-map-line"
            style={{
              lineColor: colors.brand500,
              lineWidth: 5,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        </ShapeSource>
        <MarkerView id="route-map-from" coordinate={[from.lng, from.lat]}>
          <Pin kind="from" label={from.label} testID={`${testID}-from`} />
        </MarkerView>
        <MarkerView id="route-map-to" coordinate={[to.lng, to.lat]}>
          <Pin kind="to" label={to.label} testID={`${testID}-to`} />
        </MarkerView>
        {courier ? (
          <MarkerView id="route-map-courier" coordinate={[courier.lng, courier.lat]}>
            <Pin kind="courier" testID={`${testID}-courier`} />
          </MarkerView>
        ) : null}
      </MapView>
    </View>
  );
}

/**
 * Carte d’itinéraire : retrait, destination, livreur, et un tracé rose entre les deux.
 *
 * Avec un jeton Mapbox, sur téléphone : la vraie carte. Sinon (web, tests, build sans
 * jeton) : un fond de rues stylisé qui projette les points dans la boîte. Le tracé est
 * une ligne droite — aucun appel à l’API Directions.
 */
export function RouteMap({
  from,
  to,
  courier,
  height = DEFAULT_HEIGHT,
  testID = 'route-map',
}: RouteMapProps) {
  const mapbox = loadMapbox();
  if (mapbox) {
    return (
      <MapboxRoute
        mapbox={mapbox}
        from={from}
        to={to}
        courier={courier}
        height={height}
        testID={testID}
      />
    );
  }
  return <FallbackMap from={from} to={to} courier={courier} height={height} testID={testID} />;
}
