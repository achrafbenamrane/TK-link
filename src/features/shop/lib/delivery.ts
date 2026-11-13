import type { PlatformSettings } from '@/shared/lib/platform-settings';

import type { Coord } from '../model/schema';
import { distanceKm } from './geo';

/**
 * LE PRIX DE LA LIVRAISON POUR LE CLIENT — CDC V1.1 : « le coût s'affiche avant la validation,
 * jamais de frais caché ». Le barème a été arrêté le 24/10/2026 (3,00 € puis 0,80 €/km au-delà de
 * la zone de base), sur le modèle de la rémunération des livreurs TK LINK de l'époque.
 *
 * Depuis le 13/11/2026, la course est confiée à Uber Direct : son devis remplacera ce barème quand
 * le serveur le demandera. D'ici là, c'est lui qui s'affiche avant la validation.
 *
 *   frais = forfait (3,00 €) + 0,80 € × les km au-delà de la zone de base (3 km)
 */
export type DeliveryPricing = Pick<
  PlatformSettings,
  'deliveryFeeEur' | 'deliveryPerKmEur' | 'deliveryBaseZoneKm'
>;

/**
 * La distance commerçant → destination, en ligne droite, ou `null` quand on ne la connaît pas.
 *
 * Seule la position actuelle du client a des coordonnées : une adresse du carnet n'en a pas (voir
 * `AddressSchema`). Pour elle, pas de kilomètres inventés — le forfait seul s'applique.
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
  if (km === null || pricing.deliveryBaseZoneKm === null) return base;
  const extra = Math.max(0, km - pricing.deliveryBaseZoneKm) * pricing.deliveryPerKmEur;
  return Math.round((base + extra) * 100) / 100;
}
