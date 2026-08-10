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

/**
 * À QUI l'offre s'adresse — CDC §20.
 *
 * Le geste est le même (on publie un invendu), le public change : le commerçant
 * vend aux clients, le grossiste vend aux commerçants. C'est donc UN champ, pas
 * deux écrans jumeaux qui divergeraient à la première évolution.
 *
 * `.default('clients')` n'est pas décoratif : sans lui, les offres déjà
 * stockées avant l'arrivée du B2B feraient échouer `safeParse`, et le
 * commerçant perdrait tout son historique de publications.
 */
export const AUDIENCES = ['clients', 'commercants'] as const;
export type Audience = (typeof AUDIENCES)[number];

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
    audience: z.enum(AUDIENCES).default('clients'),
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
  /** Public visé — CDC §20. Les offres d'avant le B2B sont pour les clients. */
  audience: z.enum(AUDIENCES).default('clients'),
  /** Nom du vendeur, pour les lots B2B où l'on ne connaît pas l'enseigne. */
  seller: z.string().default(''),
});

export type PublishedOffer = z.infer<typeof PublishedOfferSchema>;

/**
 * Une commande passée à un grossiste — CDC §20.
 *
 * On conserve le prix unitaire AU MOMENT de la commande, pas une référence
 * vers l'offre : un lot dont le prix change ne doit pas réécrire les commandes
 * déjà passées.
 */
export const WholesaleOrderSchema = z.object({
  id: z.string().min(1),
  offerId: z.string().min(1),
  title: z.string(),
  seller: z.string().default(''),
  qty: z.number().int().positive(),
  unitCents: z.number().int().nonnegative(),
  totalCents: z.number().int().nonnegative(),
  at: z.number().int().positive(),
});

export type WholesaleOrder = z.infer<typeof WholesaleOrderSchema>;

export const PersistedMerchantSchema = z.object({
  offers: z.array(PublishedOfferSchema).default([]),
  /** Le marché B2B — conservé pour que les stocks entamés survivent — CDC §20. */
  lots: z.array(PublishedOfferSchema).default([]),
  /** Opérations consommées — CDC §9 : les cinq premières sont offertes. */
  used: z.number().int().nonnegative().default(0),
  /** Opérations achetées via des packs. */
  purchased: z.number().int().nonnegative().default(0),
  /** Ce que le commerçant a commandé en gros — CDC §20. */
  wholesaleOrders: z.array(WholesaleOrderSchema).default([]),
});
