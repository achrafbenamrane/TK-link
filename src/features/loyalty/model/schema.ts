import { z } from 'zod';

/**
 * Contrat du programme de fidélité TK LINK.
 *
 * Reprend le menu montré dans la vidéo : CARTE FIDÉLITÉ · PROMO · CATALOGUE ·
 * BONUS POINT · CADEAUX. La carte (ou la pastille collée sur la carte bancaire)
 * identifie le porteur en caisse ; chaque achat rapporte des points ; les points
 * s'échangent contre des cadeaux.
 */

/**
 * Support d'identification. La vidéo en montre deux : la carte TK LINK remise
 * au client, et la pastille sans contact collée sur sa propre carte bancaire.
 */
export const CardMediumSchema = z.enum(['carte', 'pastille']);
export type CardMedium = z.infer<typeof CardMediumSchema>;

/** Profil du porteur — la vidéo distingue explicitement les deux. */
export const HolderTypeSchema = z.enum(['particulier', 'pro']);
export type HolderType = z.infer<typeof HolderTypeSchema>;

/** La carte de fidélité de l'utilisateur. */
export const LoyaltyCardSchema = z.object({
  /** Numéro affiché et encodé dans le QR présenté en caisse. */
  number: z.string().min(8),
  medium: CardMediumSchema.default('carte'),
  holder: z.string().default(''),
  holderType: HolderTypeSchema.default('particulier'),
  activatedAt: z.number().int().positive(),
});
export type LoyaltyCard = z.infer<typeof LoyaltyCardSchema>;

/** Une entrée du compte de points — on garde l'historique, jamais un solde nu. */
export const PointsEntrySchema = z.object({
  id: z.string().min(1),
  /** Positif = gagné, négatif = dépensé. */
  points: z.number().int(),
  label: z.string().min(1),
  at: z.number().int().positive(),
  source: z.enum(['achat', 'jeu', 'parrainage', 'bonus', 'cadeau']),
});
export type PointsEntry = z.infer<typeof PointsEntrySchema>;

/** Un cadeau du catalogue, échangeable contre des points. */
export const GiftSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  partner: z.string().default(''),
  cost: z.number().int().positive(),
  /** Court descriptif affiché sur la fiche. */
  detail: z.string().default(''),
  /** Réservé aux pros, aux particuliers, ou ouvert à tous (`null`). */
  audience: HolderTypeSchema.nullable().default(null),
});
export type Gift = z.infer<typeof GiftSchema>;

/** Une offre commerçant : promo du moment ou entrée de catalogue. */
export const OfferSchema = z.object({
  id: z.string().min(1),
  merchant: z.string().min(1),
  title: z.string().min(1),
  /** Ce que l'offre annonce : « -30 % », « 2+1 offert »… */
  claim: z.string().min(1),
  category: z.string().default(''),
  /** Offre flash réservée aux membres (TKtime). */
  flash: z.boolean().default(false),
  /** Fin de validité ; `null` = permanente. */
  endsAt: z.number().int().positive().nullable().default(null),
});
export type Offer = z.infer<typeof OfferSchema>;

export const PersistedLoyaltySchema = z.object({
  card: LoyaltyCardSchema.nullable().default(null),
  entries: z.array(PointsEntrySchema).default([]),
  claimedGiftIds: z.array(z.string()).default([]),
});
export type PersistedLoyalty = z.infer<typeof PersistedLoyaltySchema>;
