import { z } from 'zod';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { CATEGORIES, CATEGORY_INFO, type Category } from '@/shared/lib/categories';
import { isSupabaseConfigured } from '@/shared/lib/env';
import { asyncStorageBackend } from '@/shared/lib/storage';

import { fetchLiveFlashes } from '../lib/feed-api';
import { fetchShopRatings } from '../lib/ratings-api';
import type { Deal, Merchant } from './schema';

/**
 * LES FLASH EN DIRECT — publiées par les commerces validés, lues sur le serveur (`flash_offers`,
 * migration 0011).
 *
 * Elles s'ajoutent au catalogue : `getDeal` et `getMerchant` (catalog.ts) les retrouvent ici quand
 * l'identifiant n'est pas celui d'un exemple. La fiche produit, le panier, les favoris et la page du
 * commerce fonctionnent donc sans savoir d'où vient l'offre.
 *
 * Ce module n'importe PAS le catalogue (c'est le catalogue qui lit celui-ci) : pas de cycle.
 *
 * Le cache est gardé sur le téléphone : un article du panier doit encore s'afficher après un
 * redémarrage hors ligne. Il est relu à chaque passage sur l'accueil.
 */

const FulfilmentSchema = z.enum(['touch-collect', 'livraison']);

export const LiveOfferSchema = z.object({
  id: z.string(),
  shopId: z.string(),
  shopName: z.string(),
  area: z.string().default(''),
  lat: z.number().nullable().default(null),
  lng: z.number().nullable().default(null),
  category: z.enum(CATEGORIES),
  title: z.string(),
  description: z.string().default(''),
  priceCents: z.number().int(),
  oldPriceCents: z.number().int(),
  stockTotal: z.number().int(),
  stockLeft: z.number().int(),
  /** Fin de l'offre, en millisecondes (un instant, pas une durée restante). */
  endsAt: z.number(),
  modes: z.array(FulfilmentSchema).default(['touch-collect', 'livraison']),
  photoUrl: z.string().default(''),
  /** La moyenne publique du commerce (0025) ; 0 : pas encore de note. */
  shopRating: z.number().default(0),
  shopRatingCount: z.number().int().default(0),
});
export type LiveOffer = z.infer<typeof LiveOfferSchema>;

/** Teinte de vignette par catégorie, faute de photo. */
const TINTS: Record<Category, string> = {
  restauration: '#F6E3C5',
  'high-tech': '#D8E4F5',
  maison: '#E7E2F5',
  mode: '#F5DCE4',
  beaute: '#F7DDE8',
  sport: '#D9EFE0',
  auto: '#E2E6EA',
  services: '#E9EDDF',
};

/**
 * Un commerce sans coordonnées (géocodage échoué) est placé au centre de Toulouse, la ville du pilote :
 * il reste visible, et le tri par distance le range au loin plutôt que de le perdre.
 */
const FALLBACK_COORD = { lat: 43.6045, lng: 1.444 };

export function liveDeal(offer: LiveOffer, nowMs: number): Deal {
  return {
    id: offer.id,
    title: offer.title,
    merchantId: offer.shopId,
    category: offer.category,
    emoji: CATEGORY_INFO[offer.category].emoji,
    ...(offer.photoUrl ? { imageUrl: offer.photoUrl } : {}),
    tint: TINTS[offer.category],
    price: offer.priceCents / 100,
    oldPrice: offer.oldPriceCents / 100,
    // La vraie moyenne du commerce (notes des clients, 0025) ; 0 tant qu'il n'en a aucune : on
    // n'invente pas de note.
    rating: offer.shopRating,
    ...(offer.shopRatingCount > 0 ? { reviewCount: offer.shopRatingCount } : {}),
    stockTotal: offer.stockTotal,
    stockLeft: offer.stockLeft,
    endsInSeconds: Math.max(0, Math.round((offer.endsAt - nowMs) / 1000)),
    endsAt: offer.endsAt,
    description: offer.description || 'Vente flash publiée par le commerçant.',
    fulfilments: offer.modes,
  };
}

export function liveMerchant(offer: LiveOffer): Merchant {
  return {
    id: offer.shopId,
    name: offer.shopName,
    area: offer.area,
    coord:
      offer.lat !== null && offer.lng !== null
        ? { lat: offer.lat, lng: offer.lng }
        : FALLBACK_COORD,
    rating: offer.shopRating,
    ratingCount: offer.shopRatingCount,
    halal: false,
    emoji: CATEGORY_INFO[offer.category].emoji,
  };
}

type LiveFeedState = {
  offers: LiveOffer[];
  /** Relit les Flash en ligne sur le serveur. Sans serveur ou sans réseau, garde le cache. */
  refresh: () => Promise<void>;
};

export const useLiveFeedStore = create<LiveFeedState>()(
  persist(
    (set) => ({
      offers: [],
      refresh: async () => {
        if (!isSupabaseConfigured) return;
        const res = await fetchLiveFlashes(new Date().toISOString());
        if (!res.ok) return;
        // Les moyennes des commerces en ligne (0025) ; sans elles, chaque offre reste « Nouveau ».
        const ratings = await fetchShopRatings(res.value.map((o) => o.shopId));
        set({
          offers: res.value.map((o) => {
            const r = ratings[o.shopId];
            return r ? { ...o, shopRating: r.average, shopRatingCount: r.count } : o;
          }),
        });
      },
    }),
    {
      name: 'tklink-live-feed-v1',
      storage: createJSONStorage(() => asyncStorageBackend),
      partialize: (s) => ({ offers: s.offers }),
      merge: (persisted, current) => {
        const parsed = z
          .object({ offers: z.array(LiveOfferSchema).default([]) })
          .safeParse(persisted);
        return parsed.success ? { ...current, ...parsed.data } : current;
      },
    },
  ),
);

/* ---- sélecteur : tranche brute uniquement (Zustand 5) ---- */
export const selectLiveOffers = (s: LiveFeedState) => s.offers;

/** Pour `getDeal` / `getMerchant` : lecture hors React, sur le cache courant. */
export function findLiveOffer(id: string): LiveOffer | undefined {
  return useLiveFeedStore.getState().offers.find((o) => o.id === id);
}

export function findLiveShop(shopId: string): LiveOffer | undefined {
  return useLiveFeedStore.getState().offers.find((o) => o.shopId === shopId);
}
