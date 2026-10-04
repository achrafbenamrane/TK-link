import type { OrderStatus } from './order-status';

/**
 * NOTER LE COMMERÇANT — CDC V1.1, Utilisateur > Points (VALIDÉ) : « après une
 * commande terminée, l'utilisateur peut noter le commerçant : étoiles et tags
 * rapides, SANS texte libre à modérer ; la moyenne s'affiche sur la vitrine du
 * commerçant ».
 */
export const RATING_TAGS = [
  'Rapide',
  'Produit frais',
  'Bien emballé',
  'Accueil agréable',
  'Conforme à l’offre',
  'Bon rapport qualité-prix',
] as const;
export type RatingTag = (typeof RATING_TAGS)[number];

export type Rating = { stars: number; tags: RatingTag[]; at: number };

/** « Terminée » : la commande est arrivée chez le client. */
export function canRate(status: OrderStatus): boolean {
  return status === 'recuperee' || status === 'livree';
}

/** Bornes l'étoile à 1–5 : un 0 n'est pas une note, c'est une absence de note. */
export function clampStars(stars: number): number {
  return Math.min(5, Math.max(1, Math.round(stars)));
}
