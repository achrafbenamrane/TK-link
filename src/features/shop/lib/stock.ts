/**
 * LA JAUGE DE STOCK « COMME UNE JAUGE D'ESSENCE » — demande du client.
 *
 * Plein = vert, à moitié = jaune, dans la réserve = rouge. Une seule fonction
 * décide de la teinte pour tous les écrans : la carte flash, la fiche offre,
 * le rail de déstockage et la vitrine du commerçant ne peuvent donc pas
 * diverger.
 *
 * ATTENTION — valeurs provisoires : le client doit nous envoyer ses formules
 * exactes. Les seuils ci-dessous sont des hypothèses de travail, pas la règle
 * finale ; le jour où elles arrivent, c'est ICI, et nulle part ailleurs, qu'on
 * les change.
 */

export type StockTone = 'plein' | 'moitie' | 'reserve';

/**
 * Part de stock restante AU-DELÀ de laquelle la jauge change de teinte.
 * - au-dessus de `moitie` : plein (vert) ;
 * - entre `reserve` (exclu) et `moitie` (inclus) : à moitié (jaune) ;
 * - `reserve` et en dessous : dans la réserve (rouge).
 */
export const STOCK_THRESHOLDS = { moitie: 0.5, reserve: 0.25 } as const;

/** Un stock initial nul ne fait jamais « plein » : il vaut la réserve. */
export function stockTone(left: number, total: number): StockTone {
  if (!(total > 0)) return 'reserve';
  const ratio = left / total;
  if (ratio > STOCK_THRESHOLDS.moitie) return 'plein';
  if (ratio > STOCK_THRESHOLDS.reserve) return 'moitie';
  return 'reserve';
}

/**
 * Les classes de chaque teinte, en LITTÉRAUX : NativeWind ne génère que les
 * classes qu'il voit écrites en toutes lettres, jamais celles qu'on assemble.
 */
export const STOCK_CLASSES: Record<StockTone, { bar: string; text: string; border: string }> = {
  plein: { bar: 'bg-success', text: 'text-success', border: 'border-success' },
  moitie: { bar: 'bg-warning', text: 'text-warning', border: 'border-warning' },
  reserve: { bar: 'bg-danger', text: 'text-danger', border: 'border-danger' },
};

/** La clé de palette de chaque teinte — pour les icônes, qui ne prennent pas de classe. */
export const STOCK_COLOR_KEY: Record<StockTone, 'success' | 'warning' | 'danger'> = {
  plein: 'success',
  moitie: 'warning',
  reserve: 'danger',
};

const TONE_WORDS: Record<StockTone, string> = {
  plein: 'plein',
  moitie: 'à moitié',
  reserve: 'presque épuisé',
};

/** Largeur de la jauge, en pourcentage entier, jamais invisible (6 % mini). */
export function stockBarPct(left: number, total: number): number {
  if (!(total > 0)) return 6;
  return Math.min(100, Math.max(6, Math.round((left / total) * 100)));
}

/**
 * Le texte lu par un lecteur d'écran : la couleur seule ne dit rien à
 * quelqu'un qui ne la voit pas.
 */
export function stockAccessibilityLabel(left: number, total: number): string {
  if (left <= 0) return 'Stock : épuisé';
  return `Stock : ${TONE_WORDS[stockTone(left, total)]}, ${left} sur ${total}`;
}
