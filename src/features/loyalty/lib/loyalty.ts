import type { Gift, HolderType, Offer, PointsEntry } from '../model/schema';

/**
 * Économie de la fidélité TK LINK — logique pure.
 *
 * Le solde n'est JAMAIS stocké : il se recalcule depuis l'historique. Un solde
 * stocké finit toujours par diverger de ses écritures ; ici c'est impossible
 * par construction.
 */

/** Points gagnés par euro dépensé. */
export const POINTS_PER_EURO = 1;

/** Palier d'échange de référence (le PDF parle de réductions et de produits offerts). */
export const REWARD_POINTS = 200;
export const REWARD_VALUE_CENTS = 200;

/** Solde courant = somme des écritures. Jamais négatif côté affichage. */
export function balanceOf(entries: PointsEntry[]): number {
  return entries.reduce((sum, e) => sum + e.points, 0);
}

/** Points gagnés pour un montant TTC en centimes (arrondi à l'euro inférieur). */
export function pointsForCents(totalCents: number): number {
  return Math.floor((totalCents / 100) * POINTS_PER_EURO);
}

/** Un cadeau est-il accessible à ce porteur, avec ce solde ? */
export function canClaim(gift: Gift, balance: number, holderType: HolderType): boolean {
  if (gift.audience !== null && gift.audience !== holderType) return false;
  return balance >= gift.cost;
}

/** Ce qu'il manque pour un cadeau (0 s'il est déjà accessible). */
export function pointsMissing(gift: Gift, balance: number): number {
  return Math.max(0, gift.cost - balance);
}

/**
 * Progression vers un cadeau, bornée à [0, 1] — sert la barre de progression.
 * Un coût nul ou négatif n'est pas censé exister ; on renvoie 1 plutôt que
 * d'exploser en division par zéro.
 */
export function progressToward(gift: Gift, balance: number): number {
  if (gift.cost <= 0) return 1;
  return Math.min(1, Math.max(0, balance / gift.cost));
}

/** Le prochain cadeau atteignable, pour donner un cap à l'utilisateur. */
export function nextGift(gifts: Gift[], balance: number, holderType: HolderType): Gift | null {
  const eligible = gifts
    .filter((g) => g.audience === null || g.audience === holderType)
    .filter((g) => g.cost > balance)
    .sort((a, b) => a.cost - b.cost);
  return eligible[0] ?? null;
}

/** Numéro de carte lisible : groupes de 4. */
export function formatCardNumber(raw: string): string {
  return (raw.match(/.{1,4}/g) ?? [raw]).join(' ');
}

/** Une offre flash est-elle encore valable ? (pas de fin = toujours valable) */
export function isOfferLive(offer: Offer, now: number = Date.now()): boolean {
  return offer.endsAt === null || offer.endsAt > now;
}

/** Temps restant lisible : « 3 j », « 5 h », « 12 min », « terminé ». */
export function timeLeft(endsAt: number | null, now: number = Date.now()): string {
  if (endsAt === null) return '';
  const ms = endsAt - now;
  if (ms <= 0) return 'terminé';
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} j`;
}
