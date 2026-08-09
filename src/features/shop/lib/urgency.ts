import type { Deal } from '../model/schema';

/**
 * L'urgence — ce qui distingue un déstockage d'un catalogue.
 *
 * Dans une place de marché, on choisit tranquillement. Ici, chaque offre est un
 * invendu qui part : il reste du temps, il reste du stock, et les deux
 * descendent. L'app doit le MONTRER, sinon elle ressemble à une boutique.
 *
 * Deux signaux, pas un : une offre peut mourir par le temps (5 minutes) ou par
 * le stock (2 pièces). Ne regarder que l'un des deux raterait la moitié des
 * dernières chances.
 */

export type Urgency = 'critique' | 'chaude' | 'normale';

/** Sous ce seuil de temps restant, c'est une dernière chance. */
export const CRITICAL_SECONDS = 300; // 5 min
export const HOT_SECONDS = 1800; // 30 min

/** Sous cette part du stock initial, c'est une dernière chance. */
export const CRITICAL_STOCK_RATIO = 0.15;
export const HOT_STOCK_RATIO = 0.35;

/** Part de stock restante, dans [0, 1]. Un stock initial nul vaut 0. */
export function stockRatio(deal: Deal): number {
  if (deal.stockTotal <= 0) return 0;
  return Math.min(1, Math.max(0, deal.stockLeft / deal.stockTotal));
}

/** Le niveau d'urgence : le plus alarmant des deux signaux l'emporte. */
export function urgencyOf(deal: Deal): Urgency {
  if (deal.stockLeft <= 0) return 'critique';
  const ratio = stockRatio(deal);
  if (deal.endsInSeconds <= CRITICAL_SECONDS || ratio <= CRITICAL_STOCK_RATIO) return 'critique';
  if (deal.endsInSeconds <= HOT_SECONDS || ratio <= HOT_STOCK_RATIO) return 'chaude';
  return 'normale';
}

/**
 * L'étiquette de déstockage. Elle dit POURQUOI le prix est tombé — sans quoi
 * une remise ressemble à une promotion de supermarché, pas à un invendu sauvé.
 */
export function liquidationLabel(deal: Deal): string {
  switch (urgencyOf(deal)) {
    case 'critique':
      return deal.stockLeft <= 3 ? 'Stock final' : 'Dernière chance';
    case 'chaude':
      return 'Ça part vite';
    default:
      return 'Invendu sauvé';
  }
}

/** Remise affichée, en pourcentage entier ; `null` sans prix barré. */
export function discountPct(deal: Deal): number | null {
  if (!deal.oldPrice || deal.oldPrice <= deal.price) return null;
  return Math.round((1 - deal.price / deal.oldPrice) * 100);
}

const WEIGHT: Record<Urgency, number> = { critique: 0, chaude: 1, normale: 2 };

/**
 * Trie par urgence : ce qui va disparaître d'abord. À urgence égale, le temps
 * restant départage. Travaille sur une COPIE — muter la liste ferait bouger
 * l'ordre sous les autres écrans.
 */
export function sortByUrgency(deals: Deal[]): Deal[] {
  return [...deals].sort((a, b) => {
    const d = WEIGHT[urgencyOf(a)] - WEIGHT[urgencyOf(b)];
    return d !== 0 ? d : a.endsInSeconds - b.endsInSeconds;
  });
}

/** Combien d'offres sont en dernière chance — sert le bandeau d'accueil. */
export function countCritical(deals: Deal[]): number {
  return deals.filter((d) => urgencyOf(d) === 'critique').length;
}
