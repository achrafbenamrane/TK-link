/**
 * OÙ MÈNE UNE OFFRE TOUCHÉE (accueil, « Dernière chance », carte, Favoris) — demande du client du
 * 14/11/2026 : à la VITRINE de son commerce, et non plus directement à la fiche produit. L'offre
 * touchée y est épinglée en tête (`offre`), avec son bouton panier ; le client découvre le commerce
 * et ses autres Flash, et la fiche produit reste à un toucher de l'offre épinglée.
 */
export function offerHref(deal: { id: string; merchantId: string }) {
  return {
    pathname: '/enseigne/[id]' as const,
    params: { id: deal.merchantId, offre: deal.id },
  };
}
