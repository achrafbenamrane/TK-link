import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { makeId } from '@/shared/lib/id';
import { asyncStorageBackend } from '@/shared/lib/storage';

import { canPublish, PACKS } from '../lib/billing';
import { seedWholesaleLots } from './seed';
import {
  PersistedMerchantSchema,
  type OfferDraft,
  type PublishedOffer,
  type WholesaleOrder,
} from './schema';

/**
 * L'espace professionnel : les offres publiées, le quota, les packs (CDC §9),
 * et les commandes passées aux grossistes (CDC §20).
 *
 * ⚠️ ZUSTAND v5 : les sélecteurs abonnés renvoient une tranche brute ou une
 * primitive, jamais un tableau recalculé (sinon boucle infinie → plantage).
 *
 * Le quota est tenu ICI, pas dans l'écran : une garde côté UI se contournerait
 * en revenant sur la page, et le CDC §9 en fait une règle commerciale, pas une
 * suggestion d'interface.
 */

type PublishResult = { ok: true; offer: PublishedOffer } | { ok: false; reason: 'quota' };

type OrderResult =
  { ok: true; order: WholesaleOrder } | { ok: false; reason: 'introuvable' | 'stock' };

type MerchantState = {
  /** MES publications, tous publics confondus. */
  offers: PublishedOffer[];
  /**
   * LE MARCHÉ des grossistes — CDC §20. Deux tableaux et non un seul : « ce
   * que j'ai publié » et « ce que je peux acheter » ne se filtrent pas l'un
   * dans l'autre sans confusion, et l'un viendra du serveur bien avant l'autre.
   */
  lots: PublishedOffer[];
  used: number;
  purchased: number;
  wholesaleOrders: WholesaleOrder[];

  /** Publie une offre flash. Échoue si le quota est épuisé — CDC §9. */
  publish: (draft: OfferDraft, seller?: string, nowMs?: number) => PublishResult;
  /**
   * Commande un lot chez un grossiste — CDC §20.
   *
   * ⚠️ Le droit de commander (rôle + SIRET, CDC §5) se vérifie AVANT, dans la
   * route : lui seul connaît le profil. Ici on ne garde que ce qui touche au
   * lot lui-même — existe-t-il, et reste-t-il assez de stock.
   */
  orderLot: (offerId: string, qty: number, nowMs?: number) => OrderResult;
  /** Retire une offre avant son terme. */
  takeOffline: (id: string) => void;
  /** Simule une vente : décrémente le stock (le vrai flux viendra du serveur). */
  sellOne: (id: string) => void;
  /** Achète un pack d'opérations — CDC §9. */
  buyPack: (packId: string) => boolean;
  resetDemo: () => void;
};

export const useMerchantStore = create<MerchantState>()(
  persist(
    (set, get) => ({
      offers: [],
      lots: seedWholesaleLots(),
      used: 0,
      purchased: 0,
      wholesaleOrders: [],

      publish: (draft, seller = '', nowMs = Date.now()) => {
        const s = get();
        if (!canPublish(s.used, s.purchased)) return { ok: false, reason: 'quota' };

        const offer: PublishedOffer = {
          id: makeId(),
          title: draft.title,
          category: draft.category,
          priceCents: draft.priceCents,
          oldPriceCents: draft.oldPriceCents,
          stock: draft.stock,
          stockLeft: draft.stock,
          durationMinutes: draft.durationMinutes,
          description: draft.description,
          publishedAt: nowMs,
          offline: false,
          audience: draft.audience,
          seller,
        };

        set({ offers: [offer, ...s.offers], used: s.used + 1 });
        return { ok: true, offer };
      },

      takeOffline: (id) =>
        set((s) => ({
          offers: s.offers.map((o) => (o.id === id ? { ...o, offline: true } : o)),
        })),

      sellOne: (id) =>
        set((s) => ({
          offers: s.offers.map((o) =>
            o.id === id ? { ...o, stockLeft: Math.max(0, o.stockLeft - 1) } : o,
          ),
        })),

      orderLot: (offerId, qty, nowMs = Date.now()) => {
        const s = get();
        // Le lot peut venir du marché OU de mes propres publications B2B (un
        // grossiste qui teste son annonce depuis le même appareil).
        const lot = s.lots.find((o) => o.id === offerId) ?? s.offers.find((o) => o.id === offerId);
        if (!lot) return { ok: false, reason: 'introuvable' };
        if (qty <= 0 || lot.stockLeft < qty) return { ok: false, reason: 'stock' };

        const order: WholesaleOrder = {
          id: makeId(),
          offerId: lot.id,
          title: lot.title,
          seller: lot.seller,
          qty,
          // Prix figé à la commande : un lot dont le prix bouge ne doit pas
          // réécrire ce qui a déjà été commandé.
          unitCents: lot.priceCents,
          totalCents: lot.priceCents * qty,
          at: nowMs,
        };

        const take = (list: PublishedOffer[]) =>
          list.map((o) => (o.id === offerId ? { ...o, stockLeft: o.stockLeft - qty } : o));

        set({
          lots: take(s.lots),
          offers: take(s.offers),
          wholesaleOrders: [order, ...s.wholesaleOrders],
        });
        return { ok: true, order };
      },

      buyPack: (packId) => {
        const pack = PACKS.find((p) => p.id === packId);
        if (!pack) return false;
        set((s) => ({ purchased: s.purchased + pack.operations }));
        return true;
      },

      resetDemo: () =>
        set({
          offers: [],
          lots: seedWholesaleLots(),
          used: 0,
          purchased: 0,
          wholesaleOrders: [],
        }),
    }),
    {
      name: 'tklink-merchant-v1',
      storage: createJSONStorage(() => asyncStorageBackend),
      partialize: (s) => ({
        offers: s.offers,
        lots: s.lots,
        used: s.used,
        purchased: s.purchased,
        wholesaleOrders: s.wholesaleOrders,
      }),
      merge: (persisted, current) => {
        const parsed = PersistedMerchantSchema.safeParse(persisted);
        return parsed.success ? { ...current, ...parsed.data } : current;
      },
    },
  ),
);

/* ---- sélecteurs : tranches brutes ou primitives uniquement ---- */
export const selectOffers = (s: MerchantState) => s.offers;
export const selectLots = (s: MerchantState) => s.lots;
export const selectUsed = (s: MerchantState) => s.used;
export const selectPurchased = (s: MerchantState) => s.purchased;
export const selectWholesaleOrders = (s: MerchantState) => s.wholesaleOrders;
