import type { Address, Coord } from '../model/schema';
import { MAPBOX_PUBLIC_TOKEN } from './mapbox';

/** Adresse écrite telle qu'on l'envoie au géocodeur. */
export function addressQuery(address: Address): string {
  return `${address.street}, ${address.zip} ${address.city}`;
}

type GeocodeResponse = {
  features?: { geometry?: { coordinates?: [number, number] } }[];
};

/**
 * Transforme une adresse postale en coordonnées (API Mapbox Geocoding v6).
 *
 * Renvoie `null` — jamais une erreur — si le réseau, le jeton ou la réponse
 * font défaut : le suivi de livraison est un bonus, il ne doit pas empêcher de
 * consulter sa commande. Résultat borné à la France, ce qui écarte les
 * homonymes lointains (« Toulouse » existe aussi aux États-Unis).
 */
export async function geocodeAddress(
  address: Address,
  signal?: AbortSignal,
): Promise<Coord | null> {
  if (!MAPBOX_PUBLIC_TOKEN) return null;

  const url =
    'https://api.mapbox.com/search/geocode/v6/forward' +
    `?q=${encodeURIComponent(addressQuery(address))}` +
    `&country=fr&limit=1&access_token=${MAPBOX_PUBLIC_TOKEN}`;

  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const json = (await res.json()) as GeocodeResponse;
    const coords = json.features?.[0]?.geometry?.coordinates;
    // GeoJSON range en [lng, lat] — l'inverse de ce qu'on manipule partout
    // ailleurs. L'oubli de cette inversion place Toulouse en Somalie.
    if (!coords || coords.length < 2) return null;
    const [lng, lat] = coords;
    if (typeof lng !== 'number' || typeof lat !== 'number') return null;
    return { lat, lng };
  } catch {
    return null;
  }
}
