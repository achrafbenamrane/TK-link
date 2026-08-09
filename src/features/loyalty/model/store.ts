import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { makeId } from '@/shared/lib/id';
import { asyncStorageBackend } from '@/shared/lib/storage';

import { balanceOf } from '../lib/loyalty';
import { GIFTS, seedCard, seedEntries, seedOffers } from './seed';
import {
  PersistedLoyaltySchema,
  type CardMedium,
  type Gift,
  type HolderType,
  type LoyaltyCard,
  type Offer,
  type PointsEntry,
} from './schema';

/**
 * Programme de fidélité — carte, points, cadeaux.
 *
 * ⚠️ ZUSTAND v5 : les sélecteurs abonnés renvoient une tranche brute ou une
 * primitive, jamais un tableau recalculé (sinon boucle infinie → plantage).
 * Le solde est une PRIMITIVE dérivée : sûr à l'abonnement.
 */

type LoyaltyState = {
  card: LoyaltyCard | null;
  entries: PointsEntry[];
  claimedGiftIds: string[];
  /** Catalogue : figé côté démo, il viendra du back-office. */
  gifts: Gift[];
  offers: Offer[];

  /** Active la carte (ou la pastille) remise à l'utilisateur. */
  activateCard: (input: {
    number?: string;
    medium?: CardMedium;
    holder?: string;
    holderType?: HolderType;
  }) => void;
  setHolderType: (t: HolderType) => void;
  /** Crédite des points (achat, jeu, parrainage, bonus). */
  earn: (points: number, label: string, source?: PointsEntry['source']) => void;
  /** Échange un cadeau ; renvoie false si le solde est insuffisant. */
  claimGift: (giftId: string) => boolean;
  resetDemo: () => void;
};

export const useLoyaltyStore = create<LoyaltyState>()(
  persist(
    (set, get) => ({
      card: seedCard(),
      entries: seedEntries(),
      claimedGiftIds: [],
      gifts: GIFTS,
      offers: seedOffers(),

      activateCard: (input) =>
        set((s) => ({
          card: {
            number: input.number ?? s.card?.number ?? '70142299',
            medium: input.medium ?? s.card?.medium ?? 'carte',
            holder: input.holder ?? s.card?.holder ?? '',
            holderType: input.holderType ?? s.card?.holderType ?? 'particulier',
            activatedAt: s.card?.activatedAt ?? Date.now(),
          },
        })),

      setHolderType: (holderType) => set((s) => (s.card ? { card: { ...s.card, holderType } } : s)),

      earn: (points, label, source = 'bonus') =>
        set((s) => ({
          entries: [{ id: makeId(), points, label, at: Date.now(), source }, ...s.entries],
        })),

      claimGift: (giftId) => {
        const { gifts, entries, claimedGiftIds } = get();
        const g = gifts.find((x) => x.id === giftId);
        if (!g) return false;
        if (balanceOf(entries) < g.cost) return false;
        set({
          entries: [
            { id: makeId(), points: -g.cost, label: g.title, at: Date.now(), source: 'cadeau' },
            ...entries,
          ],
          claimedGiftIds: [giftId, ...claimedGiftIds],
        });
        return true;
      },

      resetDemo: () =>
        set({
          card: seedCard(),
          entries: seedEntries(),
          claimedGiftIds: [],
          gifts: GIFTS,
          offers: seedOffers(),
        }),
    }),
    {
      name: 'tklink-loyalty-v1',
      storage: createJSONStorage(() => asyncStorageBackend),
      partialize: (s) => ({ card: s.card, entries: s.entries, claimedGiftIds: s.claimedGiftIds }),
      merge: (persisted, current) => {
        const parsed = PersistedLoyaltySchema.safeParse(persisted);
        return parsed.success ? { ...current, ...parsed.data } : current;
      },
    },
  ),
);

/* ---- sélecteurs : tranches brutes ou primitives uniquement ---- */

export const selectCard = (s: LoyaltyState) => s.card;
export const selectEntries = (s: LoyaltyState) => s.entries;
export const selectGifts = (s: LoyaltyState) => s.gifts;
export const selectOffers = (s: LoyaltyState) => s.offers;
export const selectClaimedGiftIds = (s: LoyaltyState) => s.claimedGiftIds;
/** Primitive dérivée → sûr à l'abonnement. */
export const selectBalance = (s: LoyaltyState) => balanceOf(s.entries);
