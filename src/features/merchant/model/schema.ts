import { z } from 'zod';

import { CATEGORIES } from '@/shared/lib/categories';

/**
 * Contrat de l'offre flash publiée par un commerçant — CDC §9.
 *
 * Le §8 fixe ce qu'une offre doit montrer au client : image, prix initial, prix
 * promo, quantité, compte à rebours. C'est donc exactement ce que le formulaire
 * doit obtenir, ni plus (on ne demande rien qui ne s'affiche) ni moins (une
 * offre sans prix barré n'est pas une offre flash).
 */

/** Durées proposées, en minutes. Une vente flash se compte en minutes. */
export const DURATIONS = [15, 30, 60, 120, 240] as const;
export type Duration = (typeof DURATIONS)[number];

export const OfferDraftSchema = z
  .object({
    title: z.string().trim().min(3, 'Titre trop court').max(60, 'Titre trop long'),
    category: z.enum(CATEGORIES),
    /** Prix flash, en centimes. */
    priceCents: z.number().int().positive('Indiquez un prix'),
    /** Prix barré, en centimes. */
    oldPriceCents: z.number().int().positive('Indiquez le prix initial'),
    stock: z.number().int().positive('Indiquez la quantité').max(999, 'Quantité trop élevée'),
    durationMinutes: z.number().int().positive(),
    description: z.string().trim().max(240).default(''),
  })
  .refine((o) => o.oldPriceCents > o.priceCents, {
    // Sans cette règle on publierait des « promotions » plus chères que le prix
    // barré. C'est le genre d'erreur qui ne se voit qu'une fois en ligne.
    path: ['priceCents'],
    error: 'Le prix flash doit être inférieur au prix initial',
  });

export type OfferDraft = z.infer<typeof OfferDraftSchema>;

/** Une offre publiée, telle qu'elle est conservée. */
export const PublishedOfferSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  category: z.enum(CATEGORIES),
  priceCents: z.number().int().nonnegative(),
  oldPriceCents: z.number().int().nonnegative(),
  stock: z.number().int().nonnegative(),
  stockLeft: z.number().int().nonnegative(),
  durationMinutes: z.number().int().positive(),
  description: z.string().default(''),
  publishedAt: z.number().int().positive(),
  /** Retirée par le commerçant avant son terme. */
  offline: z.boolean().default(false),
});

export type PublishedOffer = z.infer<typeof PublishedOfferSchema>;

export const PersistedMerchantSchema = z.object({
  offers: z.array(PublishedOfferSchema).default([]),
  /** Opérations consommées — CDC §9 : les cinq premières sont offertes. */
  used: z.number().int().nonnegative().default(0),
  /** Opérations achetées via des packs. */
  purchased: z.number().int().nonnegative().default(0),
});
