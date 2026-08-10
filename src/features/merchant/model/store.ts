import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { makeId } from '@/shared/lib/id';
import { asyncStorageBackend } from '@/shared/lib/storage';

import { canPublish, PACKS } from '../lib/billing';
import { PersistedMerchantSchema, type OfferDraft, type PublishedOffer } from './schema';

/**
 * L'espace commerçant : ses offres, son quota, ses packs — CDC §9.
 *
 * ⚠️ ZUSTAND v5 : les sélecteurs abonnés renvoient une tranche brute ou une
 * primitive, jamais un tableau recalculé (sinon boucle infinie → plantage).
 *
 * Le quota est tenu ICI, pas dans l'écran : une garde côté UI se contournerait
 * en revenant sur la page, et le CDC §9 en fait une règle commerciale, pas une
 * suggestion d'interface.
 */

type PublishResult = { ok: true; offer: PublishedOffer } | { ok: false; reason: 'quota' };

type MerchantState = {
  offers: PublishedOffer[];
  used: number;
  purchased: number;

  /** Publie une offre flash. Échoue si le quota est épuisé — CDC §9. */
  publish: (draft: OfferDraft, nowMs?: number) => PublishResult;
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
      used: 0,
      purchased: 0,

      publish: (draft, nowMs = Date.now()) => {
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

      buyPack: (packId) => {
        const pack = PACKS.find((p) => p.id === packId);
        if (!pack) return false;
        set((s) => ({ purchased: s.purchased + pack.operations }));
        return true;
      },

      resetDemo: () => set({ offers: [], used: 0, purchased: 0 }),
    }),
    {
      name: 'tklink-merchant-v1',
      storage: createJSONStorage(() => asyncStorageBackend),
      partialize: (s) => ({ offers: s.offers, used: s.used, purchased: s.purchased }),
      merge: (persisted, current) => {
        const parsed = PersistedMerchantSchema.safeParse(persisted);
        return parsed.success ? { ...current, ...parsed.data } : current;
      },
    },
  ),
);

/* ---- sélecteurs : tranches brutes ou primitives uniquement ---- */
export const selectOffers = (s: MerchantState) => s.offers;
export const selectUsed = (s: MerchantState) => s.used;
export const selectPurchased = (s: MerchantState) => s.purchased;
