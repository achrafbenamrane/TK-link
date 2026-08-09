import type { Coord, Deal, Merchant } from '../model/schema';
import { distanceKm } from './geo';

/**
 * « Ma Fan Zone » — les préférences de recherche de la maquette du client.
 *
 * Le point important : ces réglages FILTRENT réellement les résultats. Un
 * écran de préférences qui n'agit sur rien est pire que pas d'écran du tout —
 * il promet une personnalisation qui n'existe pas.
 */

/** Comment on récupère sa commande. */
export type CollectType = 'tous' | 'touch-collect' | 'livraison' | 'a-commander';

/** Régimes déclarés. Cumulables : végétarien + halal est un cas courant. */
export type LifeStyle = 'vegetarien' | 'vegan' | 'halal';

/** Rayons proposés, en kilomètres (bornes de la maquette). */
export const RADII = [5, 10, 15, 30] as const;
export type Radius = (typeof RADII)[number];

export type Preferences = {
  collect: CollectType;
  radiusKm: Radius;
  lifestyle: LifeStyle[];
};

export const DEFAULT_PREFERENCES: Preferences = {
  collect: 'tous',
  radiusKm: 10,
  lifestyle: [],
};

export const COLLECT_LABEL: Record<CollectType, string> = {
  tous: 'Tous',
  'touch-collect': 'Touch & Collect',
  livraison: 'Livraison',
  'a-commander': 'À commander',
};

export const LIFESTYLE_LABEL: Record<LifeStyle, string> = {
  vegetarien: 'Végétarien',
  vegan: 'Vegan',
  halal: 'Halal',
};

/** Ajoute / retire un régime. Fonction pure. */
export function toggleLifeStyle(list: LifeStyle[], value: LifeStyle): LifeStyle[] {
  return list.includes(value) ? list.filter((l) => l !== value) : [...list, value];
}

/**
 * Une offre respecte-t-elle les régimes déclarés ?
 *
 * Aucun régime coché = aucun filtre. Sinon l'offre doit satisfaire TOUS les
 * régimes demandés : quelqu'un qui coche vegan ET halal ne veut pas d'un plat
 * qui ne serait que l'un des deux.
 *
 * `vegan` implique `vegetarien` — l'inverse est faux.
 */
export function matchesLifeStyle(
  deal: Deal,
  merchant: Merchant | undefined,
  wanted: LifeStyle[],
): boolean {
  if (wanted.length === 0) return true;
  const diet = deal.diet ?? [];
  return wanted.every((w) => {
    if (w === 'halal') return merchant?.halal === true;
    if (w === 'vegetarien') return diet.includes('vegetarien') || diet.includes('vegan');
    return diet.includes('vegan');
  });
}

/** L'enseigne est-elle dans le rayon choisi ? Sans position connue, on n'exclut rien. */
export function withinRadius(
  merchant: Merchant | undefined,
  from: Coord | null,
  radiusKm: number,
): boolean {
  if (!merchant || !from) return true;
  return distanceKm(from, merchant.coord) <= radiusKm;
}

/**
 * Applique toutes les préférences à une liste d'offres.
 *
 * Le mode de retrait n'est pas encore porté par les données (il viendra du
 * back-end avec les capacités de chaque commerçant) : on ne filtre donc PAS
 * dessus plutôt que d'inventer un résultat faux.
 */
export function applyPreferences(
  deals: Deal[],
  merchantOf: (id: string) => Merchant | undefined,
  prefs: Preferences,
  from: Coord | null,
): Deal[] {
  return deals.filter((d) => {
    const m = merchantOf(d.merchantId);
    return matchesLifeStyle(d, m, prefs.lifestyle) && withinRadius(m, from, prefs.radiusKm);
  });
}

/** Combien de filtres sont actifs — sert la pastille « 2 » sur le bouton. */
export function activeFilterCount(prefs: Preferences): number {
  let n = prefs.lifestyle.length;
  if (prefs.collect !== DEFAULT_PREFERENCES.collect) n++;
  if (prefs.radiusKm !== DEFAULT_PREFERENCES.radiusKm) n++;
  return n;
}
