import Constants from 'expo-constants';
import { z } from 'zod';

/**
 * L'ADRESSE D'UN COMMERCE EN COORDONNÉES — géocodage Mapbox (Geocoding v6), au dépôt du dossier.
 *
 * Sans coordonnées, un commerce ne peut ni s'afficher sur la carte ni se trier par distance (« autour
 * de vous »). Le jeton est le jeton PUBLIC de la carte (pk.*), injecté au build — voir
 * `app.config.ts` (`extra.mapboxPublicToken`).
 *
 * Un échec (pas de jeton, pas de réseau, adresse introuvable) rend `null` : le dossier part quand même,
 * sans coordonnées. On ne bloque pas une inscription sur un service de cartographie.
 */

const TOKEN: string = (Constants.expoConfig?.extra?.mapboxPublicToken as string | undefined) ?? '';

const ResponseSchema = z.object({
  features: z.array(
    z.object({ geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }) }),
  ),
});

export type LatLng = { lat: number; lng: number };

export async function geocodeAddress(address: string, token = TOKEN): Promise<LatLng | null> {
  const q = address.trim();
  if (!token.startsWith('pk.') || q.length < 5) return null;
  try {
    const url =
      'https://api.mapbox.com/search/geocode/v6/forward' +
      `?q=${encodeURIComponent(q)}&country=fr&limit=1&types=address,street,place` +
      `&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const parsed = ResponseSchema.safeParse(await res.json());
    const first = parsed.success ? parsed.data.features[0] : undefined;
    if (!first) return null;
    const [lng, lat] = first.geometry.coordinates;
    return { lat, lng };
  } catch {
    return null;
  }
}
