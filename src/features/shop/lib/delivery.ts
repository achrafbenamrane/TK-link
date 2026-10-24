import type { PlatformSettings } from '@/shared/lib/platform-settings';

import type { Coord } from '../model/schema';
import { distanceKm } from './geo';

/**
 * LE PRIX DE LA LIVRAISON POUR LE CLIENT — CDC V1.1 : « le coût s'affiche avant la validation,
 * jamais de frais caché ». Le CDC ne chiffre que ce que gagne le livreur (3,00 € puis 0,80 €/km
 * au-delà de la zone de base) ; le 24/10/2026, Farid a laissé le développeur arrêter ce que paie le
 * client : le MÊME barème que le livreur. TK LINK ne perd donc rien sur la livraison, qu'elle soit
 * proche ou lointaine.
 *
 *   frais = forfait (3,00 €) + 0,80 € × les km au-delà de la zone de base (3 km)
 */
export type DeliveryPricing = Pick<
  PlatformSettings,
  'deliveryFeeEur' | 'courierPerKmEur' | 'courierBaseZoneKm'
>;

/**
 * La distance commerçant → destination, en ligne droite, ou `null` quand on ne la connaît pas.
 *
 * Seule la position actuelle du client a des coordonnées : une adresse du carnet n'en a pas (voir
 * `AddressSchema`). Pour elle, pas de kilomètres inventés — le forfait seul s'applique, des deux
 * côtés (client et livreur), avec la même mesure.
 */
export function deliveryDistanceKm(
  merchant: Coord | null | undefined,
  destination: Coord | null | undefined,
): number | null {
  if (!merchant || !destination) return null;
  return distanceKm(merchant, destination);
}

/** Les frais de livraison payés par le client, arrondis au centime. */
export function clientDeliveryFee(km: number | null, pricing: DeliveryPricing): number {
  const base = pricing.deliveryFeeEur;
  if (km === null || pricing.courierBaseZoneKm === null) return base;
  const extra = Math.max(0, km - pricing.courierBaseZoneKm) * pricing.courierPerKmEur;
  return Math.round((base + extra) * 100) / 100;
}
