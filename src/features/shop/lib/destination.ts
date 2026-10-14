import type { Address, Coord } from '../model/schema';

/**
 * Livraison à la position actuelle du client, plutôt qu’à une adresse enregistrée.
 *
 * La position n’est PAS une adresse du carnet : elle n’est jamais ajoutée à
 * `addresses` et ne survit pas à la commande. Elle est modélisée comme une adresse
 * « éphémère » d’identifiant réservé, pour que le reste de l’app (commande,
 * mission du livreur) continue de ne parler que d’une destination.
 */
export const POSITION_ADDRESS_ID = 'position';
export const POSITION_LABEL = 'Ma position actuelle';

/** Message affiché quand la position est refusée ou introuvable. */
export const POSITION_UNAVAILABLE_MESSAGE = 'Position indisponible : choisissez une adresse.';

/** La destination éphémère construite à partir d’une position GPS. */
export function positionDestination(coord: Coord): Address {
  return {
    id: POSITION_ADDRESS_ID,
    label: POSITION_LABEL,
    street: 'Position actuelle',
    zip: '',
    city: '',
    lat: coord.lat,
    lng: coord.lng,
    isDefault: false,
  };
}
