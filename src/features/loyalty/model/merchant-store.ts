import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { z } from 'zod';

import { asyncStorageBackend } from '@/shared/lib/storage';

import { transferCode, withdraw, type Tier } from '../lib/tiers';

/**
 * Fidélité par enseigne — un solde et des paliers CHEZ CHAQUE commerçant.
 *
 * ⚠️ ZUSTAND v5 : les sélecteurs abonnés renvoient une tranche brute ou une
 * primitive. Ici on s'abonne à la table entière et on dérive dans l'écran.
 */

const HistoryEntrySchema = z.object({
  id: z.string(),
  label: z.string(),
  points: z.number().int(),
  at: z.number().int().positive(),
});
export type HistoryEntry = z.infer<typeof HistoryEntrySchema>;

const CardSchema = z.object({
  points: z.number().int().nonnegative(),
  claimed: z.array(z.number().int()).default([]),
  history: z.array(HistoryEntrySchema).default([]),
});
export type MerchantCard = z.infer<typeof CardSchema>;

const PersistedSchema = z.object({ cards: z.record(z.string(), CardSchema).default({}) });

/** Les paliers, identiques pour toutes les enseignes de la démo. */
export const DEFAULT_TIERS: Tier[] = [
  { rank: 1, cost: 20, reward: '1 boisson 33 cl' },
  { rank: 2, cost: 60, reward: '2 miso soupes' },
  { rank: 3, cost: 150, reward: '4 californias saumon-cheese' },
  { rank: 4, cost: 200, reward: '8 californias saumon-cheese' },
];

const DAY = 24 * 3600 * 1000;

/** Une carte semée, pour que la démo ait de la matière dès l'ouverture. */
function seedCard(points: number, now = Date.now()): MerchantCard {
  return {
    points,
    claimed: [],
    history: [
      { id: 'h1', label: 'Commande', points: 74, at: now - 2 * DAY },
      { id: 'h2', label: 'Commande', points: 15, at: now - 9 * DAY },
      { id: 'h3', label: 'Commande', points: 12, at: now - 24 * DAY },
      { id: 'h4', label: 'Commande', points: 12, at: now - 60 * DAY },
    ],
  };
}

const seedCards = (): Record<string, MerchantCard> => ({
  m_napoli: seedCard(113),
  m_hammamet: seedCard(85),
  m_stcyp: seedCard(42),
});

type State = {
  cards: Record<string, MerchantCard>;
  /** Crédite des points chez une enseigne (achat, jeu, bonus). */
  earn: (merchantId: string, points: number, label: string) => void;
  /** Réclame un palier atteint. Renvoie false si le palier n'est pas ouvert. */
  claim: (merchantId: string, rank: number) => boolean;
  /**
   * Transfère des points à un proche : on DÉBITE et on rend un code.
   * Le crédit chez l'autre suppose un back-end — on ne prétend pas le faire.
   */
  transfer: (merchantId: string, amount: number) => string | null;
  resetDemo: () => void;
};

const emptyCard = (): MerchantCard => ({ points: 0, claimed: [], history: [] });

export const useMerchantLoyaltyStore = create<State>()(
  persist(
    (set, get) => ({
      cards: seedCards(),

      earn: (merchantId, points, label) =>
        set((s) => {
          const card = s.cards[merchantId] ?? emptyCard();
          return {
            cards: {
              ...s.cards,
              [merchantId]: {
                ...card,
                points: card.points + points,
                history: [{ id: `${Date.now()}`, label, points, at: Date.now() }, ...card.history],
              },
            },
          };
        }),

      claim: (merchantId, rank) => {
        const card = get().cards[merchantId];
        const tier = DEFAULT_TIERS.find((t) => t.rank === rank);
        if (!card || !tier) return false;
        if (card.claimed.includes(rank) || card.points < tier.cost) return false;
        set((s) => ({
          cards: {
            ...s.cards,
            [merchantId]: { ...card, claimed: [...card.claimed, rank] },
          },
        }));
        return true;
      },

      transfer: (merchantId, amount) => {
        const card = get().cards[merchantId];
        if (!card) return null;
        const left = withdraw(card.points, amount);
        if (left === null) return null;
        const at = Date.now();
        set((s) => ({
          cards: {
            ...s.cards,
            [merchantId]: {
              ...card,
              points: left,
              history: [
                { id: `${at}`, label: 'Points partagés', points: -amount, at },
                ...card.history,
              ],
            },
          },
        }));
        return transferCode(merchantId, amount, at);
      },

      resetDemo: () => set({ cards: seedCards() }),
    }),
    {
      name: 'tklink-merchant-loyalty-v1',
      storage: createJSONStorage(() => asyncStorageBackend),
      partialize: (s) => ({ cards: s.cards }),
      merge: (persisted, current) => {
        const parsed = PersistedSchema.safeParse(persisted);
        return parsed.success ? { ...current, ...parsed.data } : current;
      },
    },
  ),
);

/* ---- sélecteurs : tranche brute uniquement ---- */
export const selectCards = (s: State) => s.cards;
