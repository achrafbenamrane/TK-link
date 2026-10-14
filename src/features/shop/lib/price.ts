/**
 * Remise affichée, en pourcentage entier ; `null` sans prix barré (ou si le
 * « prix barré » n'est pas supérieur au prix payé : afficher −0 % serait un
 * mensonge). Même calcul que `discountPct(deal)` de `urgency.ts`, mais sur deux
 * nombres — ce qu'a sous la main le composant de prix.
 */
export function discountPercent(price: number, oldPrice?: number | null): number | null {
  if (typeof oldPrice !== 'number' || oldPrice <= price) return null;
  return Math.round((1 - price / oldPrice) * 100);
}
