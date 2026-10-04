import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { makeId } from '@/shared/lib/id';
import { asyncStorageBackend } from '@/shared/lib/storage';

import { canPublish } from '../lib/billing';
import { nextWholesaleStatus } from '../lib/wholesale-orders';
import { seedWholesaleLots } from './seed';
import {
  EMPTY_PROFILE,
  PersistedMerchantSchema,
  type OfferDraftInput,
  type ShopProfile,
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
  { ok: true; order: WholesaleOrder } | { ok: false; reason: 'introuvable' | 'stock' | 'minimum' };

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
  /** La boutique : présentation, horaires, photos, vidéos (CDC V1.1). */
  profile: ShopProfile;
  saveProfile: (profile: ShopProfile) => void;

  /** Publie une offre flash. Échoue si le quota est épuisé — CDC §9. */
  publish: (draft: OfferDraftInput, seller?: string, nowMs?: number) => PublishResult;
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
  /** Le grossiste fait avancer une commande reçue d'un cran — jamais en arrière, jamais deux fois. */
  advanceWholesaleOrder: (orderId: string) => boolean;
  /** Simule une vente : décrémente le stock (le vrai flux viendra du serveur). */
  sellOne: (id: string) => void;
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
      profile: EMPTY_PROFILE,
      saveProfile: (profile) => set({ profile }),

      publish: (draft, seller = '', nowMs = Date.now()) => {
        const s = get();
        // Un BROUILLON ne consomme rien et ne bute sur aucun quota : enregistrer
        // une idée n'est pas la publier. Facturer le brouillon découragerait de
        // préparer ses ventes à l'avance — exactement ce qu'on veut encourager.
        const brouillon = draft.state === 'brouillon';
        if (!brouillon && !canPublish(s.used, s.purchased)) return { ok: false, reason: 'quota' };

        const offer: PublishedOffer = {
          id: makeId(),
          title: draft.title,
          category: draft.category,
          priceCents: draft.priceCents,
          oldPriceCents: draft.oldPriceCents,
          stock: draft.stock,
          stockLeft: draft.stock,
          durationMinutes: draft.durationMinutes,
          description: draft.description ?? '',
          publishedAt: nowMs,
          // Le brouillon dit « dans 1 h », le store dit à quelle heure. Zéro
          // reste zéro : « tout de suite » n'a pas besoin d'être daté, et le
          // laisser à zéro garde le comportement des offres d'avant le §4.2.
          startsAt: draft.startInMinutes ? nowMs + draft.startInMinutes * 60_000 : 0,
          state: draft.state ?? 'publiee',
          offline: false,
          audience: draft.audience ?? 'clients',
          photoUri: draft.photoUri ?? '',
          modes: draft.modes ?? ['touch-collect', 'livraison'],
          seller,
          minQty: draft.minQty ?? 1,
        };

        set({ offers: [offer, ...s.offers], used: brouillon ? s.used : s.used + 1 });
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
        // Le minimum du grossiste (V1.1) : on ne valide pas en dessous.
        if (qty < (lot.minQty ?? 1)) return { ok: false, reason: 'minimum' };
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
          status: 'recue',
          buyer: '',
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

      advanceWholesaleOrder: (orderId) => {
        const order = get().wholesaleOrders.find((o) => o.id === orderId);
        const next = order ? nextWholesaleStatus(order.status) : null;
        if (!order || !next) return false;
        set((s) => ({
          wholesaleOrders: s.wholesaleOrders.map((o) =>
            o.id === orderId ? { ...o, status: next } : o,
          ),
        }));
        return true;
      },

      resetDemo: () =>
        set({
          offers: [],
          lots: seedWholesaleLots(),
          used: 0,
          purchased: 0,
          wholesaleOrders: [],
          profile: EMPTY_PROFILE,
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
        profile: s.profile,
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
export const selectProfile = (s: MerchantState) => s.profile;
