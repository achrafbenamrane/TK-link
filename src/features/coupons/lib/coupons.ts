import type { Discount, HeldCoupon, PromoCode, RedeemFailure } from '../model/schema';

/** Sans 0/O ni 1/I : ces codes se lisent à voix haute et se saisissent à la main. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateCode(len = 8): string {
  let out = '';
  for (let i = 0; i < len; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    if (i === 3 && len > 4) out += '-';
  }
  return out;
}

/** Normalise une saisie utilisateur avant toute comparaison de code. */
export function normalizeCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, '');
}

/** « 5 € » ou « -20 % ». */
export function formatDiscount(d: Discount): string {
  return d.kind === 'amount' ? `${(d.cents / 100).toFixed(2).replace('.', ',')} €` : `-${d.pct} %`;
}

/** Ce que la réduction retire d'un sous-total, en centimes (jamais plus que lui). */
export function discountAmountCents(d: Discount, subtotalCents: number): number {
  const raw = d.kind === 'amount' ? d.cents : Math.round((subtotalCents * d.pct) / 100);
  return Math.min(raw, subtotalCents);
}

type PromoEvaluation = { ok: true; promo: PromoCode } | { ok: false; reason: RedeemFailure };

/**
 * Peut-on réclamer ce code promo, ici, maintenant ? Fonction PURE — aucune
 * écriture, aucun accès réseau —, pour que chaque règle soit testable seule.
 *
 * L'ordre des refus est délibéré : « inconnu » avant tout (ne rien révéler sur
 * un code qui n'existe pas), puis désactivé, expiré, déjà réclamé, plafond.
 */
export function evaluatePromo(
  rawCode: string,
  catalog: PromoCode[],
  wallet: HeldCoupon[],
  now: number,
): PromoEvaluation {
  const code = normalizeCode(rawCode);
  const promo = catalog.find((p) => p.code === code);
  if (!promo) return { ok: false, reason: 'unknown' };
  if (!promo.active) return { ok: false, reason: 'inactive' };
  if (promo.expiresAt !== null && promo.expiresAt <= now) return { ok: false, reason: 'expired' };

  // Une seule fois par personne : le portefeuille contient déjà ce code.
  if (wallet.some((c) => c.code === code)) return { ok: false, reason: 'already_claimed' };

  if (promo.maxRedemptions !== null && promo.redeemedCount >= promo.maxRedemptions) {
    return { ok: false, reason: 'cap_reached' };
  }
  return { ok: true, promo };
}

/** Un code promo est-il encore exploitable (affichage admin) ? */
export function isPromoLive(promo: PromoCode, now: number): boolean {
  if (!promo.active) return false;
  if (promo.expiresAt !== null && promo.expiresAt <= now) return false;
  if (promo.maxRedemptions !== null && promo.redeemedCount >= promo.maxRedemptions) return false;
  return true;
}
