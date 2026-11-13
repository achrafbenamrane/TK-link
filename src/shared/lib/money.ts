/**
 * UN PRIX, À LA FRANÇAISE : « 24,90 € » — virgule décimale, espace insécable avant l'euro.
 *
 * Chaque écran formatait le sien : « 24.90€ » à l'accueil et au panier (comme sur la maquette),
 * « 24,90€ » sur la fiche, « 24,90 € » côté commerçant — et la fiche produit montrait les deux formes
 * à la fois, sur sa carte et sur son bouton (13/11/2026). L'espace insécable garde « € » collé à son
 * montant en fin de ligne.
 */
export function formatEuros(value: number): string {
  return `${value.toFixed(2).replace('.', ',')} €`;
}
