/**
 * LE CODE DE REMISE AU LIVREUR — CDC V1.1, Livreur > Process : « retrait chez le
 * commerçant : scan QR ou code PIN ».
 *
 * Le commerçant (qui voit son ticket) et le livreur (qui est au comptoir)
 * doivent s'accorder sur un code court, sans serveur : il est DÉRIVÉ de
 * l'identifiant de commande, donc identique des deux côtés. En production, c'est
 * le serveur qui l'émet et le vérifie ; ce module en garde la forme.
 */
export function pickupPin(orderId: string): string {
  let h = 0;
  for (let i = 0; i < orderId.length; i++) h = (h * 31 + orderId.charCodeAt(i)) % 10_000;
  return String(h).padStart(4, '0');
}

export function isValidPickupPin(orderId: string, entered: string): boolean {
  return entered.trim() === pickupPin(orderId);
}

/**
 * « Colis important » : celui dont la remise exige une confirmation biométrique
 * du livreur (V1.1). Le CDC ne dit pas à partir de quand un colis l'est : le
 * seuil est un paramètre `null` tant que Farid ne l'a pas arrêté, et aucun colis
 * n'est alors réputé important — on n'invente pas de seuil.
 */
export function isImportantParcel(totalEur: number, minEur: number | null): boolean {
  return minEur !== null && totalEur >= minEur;
}
