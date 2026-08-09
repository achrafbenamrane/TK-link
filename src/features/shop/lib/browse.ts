import type { Category, Coord, Deal, Merchant } from '../model/schema';
import { distanceKm } from './geo';

/**
 * « Parcourir » — la découverte par COMMERCE, pas par offre.
 *
 * L'accueil déroule les ventes flash une par une ; ici on regarde les
 * enseignes : combien de flashs chacune propose en ce moment, à quelle
 * distance, et où en est ma fidélité chez elle. Ce sont deux questions
 * différentes, d'où deux écrans — les confondre était l'erreur.
 */

export type MerchantSummary = {
  merchant: Merchant;
  /** Ventes flash en cours chez cette enseigne. */
  flashCount: number;
  /** Catégories couvertes par ses offres. */
  categories: Category[];
  /** Distance depuis l'utilisateur, `null` si la position est inconnue. */
  distanceKm: number | null;
  /** La plus proche échéance parmi ses offres — sert le tri « dernières chances ». */
  endsInSeconds: number | null;
  /** Meilleure remise affichée, en pourcentage entier. */
  bestDiscount: number | null;
};

export type SortKey = 'derniere-chance' | 'proximite' | 'note';

export const SORT_LABEL: Record<SortKey, string> = {
  'derniere-chance': 'Dernières chances',
  proximite: 'Les plus proches',
  note: 'Les mieux notés',
};

/** Remise d'une offre, en pourcentage entier (0 si pas de prix barré). */
function discountOf(deal: Deal): number {
  if (!deal.oldPrice || deal.oldPrice <= 0) return 0;
  return Math.round((1 - deal.price / deal.oldPrice) * 100);
}

/**
 * Regroupe les offres par enseigne. Une enseigne SANS offre en cours
 * n'apparaît pas : « Parcourir » montre ce qui est disponible maintenant, pas
 * un annuaire.
 */
export function summarize(
  deals: Deal[],
  merchantOf: (id: string) => Merchant | undefined,
  from: Coord | null,
): MerchantSummary[] {
  const byMerchant = new Map<string, Deal[]>();
  for (const d of deals) {
    const bucket = byMerchant.get(d.merchantId);
    if (bucket) bucket.push(d);
    else byMerchant.set(d.merchantId, [d]);
  }

  const out: MerchantSummary[] = [];
  for (const [id, list] of byMerchant) {
    const merchant = merchantOf(id);
    if (!merchant) continue;
    out.push({
      merchant,
      flashCount: list.length,
      categories: [...new Set(list.map((d) => d.category))],
      distanceKm: from ? distanceKm(from, merchant.coord) : null,
      endsInSeconds: Math.min(...list.map((d) => d.endsInSeconds)),
      bestDiscount: Math.max(...list.map(discountOf)) || null,
    });
  }
  return out;
}

/**
 * Trie les enseignes. Le tri se fait sur une COPIE : muter la liste reçue
 * ferait bouger l'ordre sous les autres écrans qui partagent la référence.
 */
export function sortSummaries(list: MerchantSummary[], key: SortKey): MerchantSummary[] {
  const copy = [...list];
  if (key === 'proximite') {
    // Sans position connue, on ne peut pas classer : on garde l'ordre reçu
    // plutôt que d'inventer un classement.
    return copy.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  }
  if (key === 'note') return copy.sort((a, b) => b.merchant.rating - a.merchant.rating);
  return copy.sort((a, b) => (a.endsInSeconds ?? Infinity) - (b.endsInSeconds ?? Infinity));
}

/** Recherche sur le nom de l'enseigne, son quartier et ses offres. */
export function searchSummaries(
  list: MerchantSummary[],
  deals: Deal[],
  query: string,
): MerchantSummary[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((s) => {
    if (`${s.merchant.name} ${s.merchant.area}`.toLowerCase().includes(q)) return true;
    return deals.some((d) => d.merchantId === s.merchant.id && d.title.toLowerCase().includes(q));
  });
}

/** « 3 FLASHS » / « 1 FLASH » — l'accord de la maquette. */
export function flashLabel(count: number): string {
  return `${count} FLASH${count > 1 ? 'S' : ''}`;
}
