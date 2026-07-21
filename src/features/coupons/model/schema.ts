import { z } from 'zod';

/**
 * Contrat du système de coupons — deux sources, une seule mécanique de code.
 *
 *  • COUPON GAGNÉ (jeu) : personnel, à usage unique, code généré pour un seul
 *    utilisateur. Il naît directement dans son portefeuille.
 *  • CODE PROMO (admin) : créé par l'admin, partagé publiquement (réseaux
 *    sociaux). Utilisable par PLUSIEURS personnes — mais une seule fois chacune —
 *    avec une date d'expiration et une désactivation manuelle.
 *
 * Les deux finissent en `HeldCoupon` dans le portefeuille : un coupon gagné y
 * est d'emblée, un code promo y entre une fois saisi et validé. Ça unifie
 * l'application à la caisse : peu importe d'où vient la réduction.
 *
 * Ces schémas sont le contrat que le back-end (Supabase) devra respecter :
 * l'admin et le suivi « qui a utilisé quoi » vivront côté serveur, protégés par
 * un rôle. Ici, en démo, tout est local.
 */

/** Une réduction : montant fixe en centimes, ou pourcentage. */
export const DiscountSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('amount'), cents: z.number().int().positive() }),
  z.object({ kind: z.literal('percent'), pct: z.number().int().min(1).max(100) }),
]);
export type Discount = z.infer<typeof DiscountSchema>;

/** Un coupon détenu par l'utilisateur, prêt à être appliqué (source unifiée). */
export const HeldCouponSchema = z.object({
  id: z.string().min(1),
  code: z.string().min(3),
  source: z.enum(['game', 'promo']),
  discount: DiscountSchema,
  /** Étiquette lisible : « Victoire au quiz », « Code Instagram »… */
  label: z.string().default(''),
  createdAt: z.number().int().positive(),
  /** Usage unique : rempli quand le coupon a servi à une commande. */
  usedAt: z.number().int().positive().nullable().default(null),
});
export type HeldCoupon = z.infer<typeof HeldCouponSchema>;

/**
 * Un code promo tel que l'admin le crée. En production, cette table vit côté
 * serveur ; `redeemedCount` y est la vérité, pas une valeur que le client
 * pourrait forger.
 */
export const PromoCodeSchema = z.object({
  id: z.string().min(1),
  /** Toujours en majuscules : la saisie est normalisée avant comparaison. */
  code: z
    .string()
    .regex(/^[A-Z0-9-]{3,24}$/, 'Lettres majuscules, chiffres et tirets, 3 à 24 caractères.'),
  discount: DiscountSchema,
  label: z.string().default(''),
  createdAt: z.number().int().positive(),
  /** `null` = pas d'expiration. */
  expiresAt: z.number().int().positive().nullable().default(null),
  /** L'admin peut couper un code à tout moment, indépendamment de l'expiration. */
  active: z.boolean().default(true),
  /** Plafond global d'utilisations ; `null` = illimité. */
  maxRedemptions: z.number().int().positive().nullable().default(null),
  redeemedCount: z.number().int().nonnegative().default(0),
});
export type PromoCode = z.infer<typeof PromoCodeSchema>;

/** Champs saisis par l'admin ; l'id, le code auto et les compteurs sont gérés. */
export const PromoDraftSchema = z.object({
  discount: DiscountSchema,
  label: z.string().max(40).optional(),
  /** Code choisi (mémorable, ex. NOEL2026) ou vide pour auto-génération. */
  code: z
    .string()
    .regex(/^[A-Za-z0-9-]{3,24}$/, '3 à 24 caractères : lettres, chiffres, tirets.')
    .optional()
    .or(z.literal('')),
  expiresAt: z.number().int().positive().nullable().default(null),
  maxRedemptions: z.number().int().positive().nullable().default(null),
});
export type PromoDraft = z.infer<typeof PromoDraftSchema>;

/** Pourquoi un code a été refusé — chaque cas a son message côté UI. */
export type RedeemFailure = 'unknown' | 'inactive' | 'expired' | 'already_claimed' | 'cap_reached';

export const PersistedCouponsSchema = z.object({
  wallet: z.array(HeldCouponSchema).default([]),
  promoCatalog: z.array(PromoCodeSchema).default([]),
});
export type PersistedCoupons = z.infer<typeof PersistedCouponsSchema>;
