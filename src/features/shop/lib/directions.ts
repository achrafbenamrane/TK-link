import type { Coord } from '../model/schema';
import { distanceKm } from './geo';
import { MAPBOX_PUBLIC_TOKEN } from './mapbox';

/** Un trajet routier : la ligne à tracer + ce qu'on affiche à l'utilisateur. */
export type Route = {
  /** Points [lng, lat] — l'ordre attendu par GeoJSON et Mapbox. */
  coordinates: [number, number][];
  km: number;
  minutes: number;
  /** true quand l'API n'a pas répondu et qu'on est retombé sur la ligne droite. */
  approximate: boolean;
};

/** Repli hors-ligne : ligne droite + estimation à 18 km/h (scooter en ville). */
export function straightLine(from: Coord, to: Coord): Route {
  const km = distanceKm(from, to);
  return {
    coordinates: [
      [from.lng, from.lat],
      [to.lng, to.lat],
    ],
    km,
    minutes: Math.max(1, Math.round((km / 18) * 60)),
    approximate: true,
  };
}

type DirectionsResponse = {
  routes?: {
    geometry?: { coordinates?: [number, number][] };
    distance?: number;
    duration?: number;
  }[];
};

/**
 * Trajet routier réel via l'API Mapbox Directions.
 *
 * Le catalogue est entièrement hors-ligne : cet appel réseau est le seul de la
 * vue carte, donc il échoue en douceur. Pas de réseau, pas de jeton, réponse
 * inattendue → on renvoie la ligne droite plutôt que rien. L'appelant sait que
 * c'est une approximation grâce à `approximate`.
 */
export async function fetchRoute(from: Coord, to: Coord, signal?: AbortSignal): Promise<Route> {
  if (!MAPBOX_PUBLIC_TOKEN) return straightLine(from, to);

  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}` +
    `?geometries=geojson&overview=full&access_token=${MAPBOX_PUBLIC_TOKEN}`;

  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return straightLine(from, to);

    const json = (await res.json()) as DirectionsResponse;
    const route = json.routes?.[0];
    const line = route?.geometry?.coordinates;
    if (
      !line?.length ||
      typeof route?.distance !== 'number' ||
      typeof route?.duration !== 'number'
    ) {
      return straightLine(from, to);
    }

    return {
      coordinates: line,
      km: route.distance / 1000,
      minutes: Math.max(1, Math.round(route.duration / 60)),
      approximate: false,
    };
  } catch {
    // Réseau coupé, requête annulée (l'utilisateur a tapé une autre bulle)…
    return straightLine(from, to);
  }
}

/** GeoJSON attendu par Mapbox ShapeSource. */
export function routeToGeoJSON(route: Route) {
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'LineString' as const, coordinates: route.coordinates },
  };
}
