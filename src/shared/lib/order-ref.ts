/**
 * LA RÉFÉRENCE D'UNE COMMANDE — « #TKL-4A1B2C », celle qu'on lit à voix haute au comptoir.
 *
 * Un seul format pour le client, le commerçant, le grossiste et la facture : la même commande
 * s'écrivait « #DEMO_O » au suivi, « #TKL-4A1B2C » au tableau de bord et « demo_ord_4a1b2c » (coupée
 * en deux lignes) sur la facture.
 */
export function orderRef(id: string): string {
  return `#TKL-${id.slice(-6).toUpperCase()}`;
}
