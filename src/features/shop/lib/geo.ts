import type { Coord } from '../model/schema';

/**
 * Great-circle distance in km (haversine).
 *
 * Ported from `packs/maps-view/src/nearby.ts` — the pack itself is excluded from
 * tsconfig/ESLint and app code may not import across that boundary, so the helper
 * lives here. The pack's `fetchNearby` was deliberately NOT ported: it queries a
 * Supabase table, and this catalog is static.
 */
export function distanceKm(a: Coord, b: Coord): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** « 1,2 km » / « 800 m » — distance lisible, format français. */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 100) * 10} m`;
  return `${km.toFixed(1).replace('.', ',')} km`;
}

/** Centre de Toulouse — repli quand la position réelle est refusée ou indisponible. */
export const TOULOUSE_CENTER: Coord = { lat: 43.6045, lng: 1.4442 };
