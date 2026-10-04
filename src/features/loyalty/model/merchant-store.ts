import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { z } from 'zod';

import { asyncStorageBackend } from '@/shared/lib/storage';

import type { ProgramUnit, Tier } from '../lib/tiers';

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

/**
 * Un palier tel qu'il se stocke — CDC §8.3.
 *
 * Le coût est plafonné : un palier à cent mille points n'est pas une
 * récompense, c'est une carotte hors d'atteinte, et le §8.3 parle d'avantages
 * que le client doit pouvoir obtenir.
 */
const TierSchema = z.object({
  rank: z.number().int().positive(),
  cost: z.number().int().positive().max(100_000),
  reward: z.string().trim().min(1).max(60),
});

/**
 * Le programme d'UN commerçant — CDC V1.1 : ses paliers (jusqu'à quatre) et
 * l'unité de calcul, choisie à la création puis figée une fois en ligne.
 */
const ProgramSchema = z.object({
  unit: z.enum(['euros', 'achats']),
  tiers: z.array(TierSchema).min(1).max(4),
});
export type Program = { unit: ProgramUnit; tiers: Tier[] };

/**
 * Une récompense DÉBLOQUÉE — l'inventaire du client (CDC V1.1 : « seule la
 * récompense déjà débloquée est partageable entre comptes, jamais les points
 * bruts »). On y entre en réclamant un palier ; on en sort en la faisant valider
 * par QR chez le commerçant, ou en la partageant.
 */
const RewardSchema = z.object({
  id: z.string(),
  merchantId: z.string(),
  merchantName: z.string().default(''),
  rank: z.number().int().positive(),
  label: z.string(),
  /** Le code lu par le commerçant (le QR le contient). */
  code: z.string(),
  status: z.enum(['disponible', 'utilisee', 'partagee']),
  at: z.number().int().positive(),
});
export type Reward = z.infer<typeof RewardSchema>;

const PersistedSchema = z.object({
  cards: z.record(z.string(), CardSchema).default({}),
  /**
   * Un programme par commerçant. Le défaut `{}` n'est pas décoratif : ce schéma
   * relit des données déjà présentes sur les téléphones, enregistrées quand les
   * paliers étaient UNE liste partagée (`tiers`). Sans défaut, toutes les cartes
   * — points, avantages réclamés, historique — seraient effacées à la
   * réhydratation. L'ancienne clé `tiers` est simplement ignorée.
   */
  programs: z.record(z.string(), ProgramSchema).default({}),
  /** L'inventaire de récompenses. `.default([])` : les anciennes données n'en ont pas. */
  rewards: z.array(RewardSchema).default([]),
});

/** Les paliers proposés tant qu'un commerçant n'a pas configuré les siens. */
export const DEFAULT_TIERS: Tier[] = [
  { rank: 1, cost: 20, reward: '1 boisson 33 cl' },
  { rank: 2, cost: 60, reward: '2 miso soupes' },
  { rank: 3, cost: 150, reward: '4 californias saumon-cheese' },
  { rank: 4, cost: 200, reward: '8 californias saumon-cheese' },
];

/**
 * Le programme en vigueur chez un commerçant qui n'a rien configuré : 1 € = 1
 * point et les quatre paliers par défaut. Il reste MODIFIABLE (l'unité n'est
 * figée qu'à la première sauvegarde, c'est-à-dire à la mise en ligne).
 */
export const DEFAULT_PROGRAM: Program = { unit: 'euros', tiers: DEFAULT_TIERS };

const DAY = 24 * 3600 * 1000;

/** Une carte semée — pour les tests et « remettre la démo », jamais au premier lancement. */
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
  /** Les programmes CONFIGURÉS, par commerçant. Absent = programme par défaut. */
  programs: Record<string, Program>;
  /**
   * Enregistre le programme d'un commerçant — CDC V1.1.
   *
   * Un programme déjà enregistré est EN LIGNE : son unité ne change plus, même
   * si l'appelant en passe une autre. Les avantages DÉJÀ RÉCLAMÉS ne sont pas
   * repris : un client qui a obtenu sa boisson ne la rend pas parce que le
   * commerçant a changé son barème. On renumérote donc les rangs sans toucher
   * aux cartes.
   */
  saveProgram: (merchantId: string, program: Program) => void;
  /** Crédite des points chez une enseigne, pour un achat (CDC §8.1). */
  earn: (merchantId: string, points: number, label: string) => void;
  /** L'inventaire de récompenses débloquées. */
  rewards: Reward[];
  /**
   * Réclame un palier atteint : il devient une récompense dans l'inventaire.
   * Renvoie false si le palier n'est pas ouvert. `merchantName` n'est que
   * l'étiquette affichée dans l'inventaire.
   */
  claim: (merchantId: string, rank: number, merchantName?: string) => boolean;
  /**
   * Partage une récompense débloquée avec un autre compte. Elle quitte alors
   * cet inventaire : sans cela, on la partagerait et on l'utiliserait aussi.
   */
  shareReward: (rewardId: string) => boolean;
  /**
   * Le commerçant valide une récompense : il lit le code du QR. Refuse un code
   * inconnu, déjà utilisé, partagé, ou d'un autre commerçant.
   */
  redeemReward: (
    merchantId: string,
    code: string,
  ) => { ok: true; reward: Reward } | { ok: false; reason: 'inconnu' | 'deja_utilisee' };
  resetDemo: () => void;
};

/** Un code lisible, sans caractères qui se confondent (0/O, 1/I). */
function rewardCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `TK-${out}`;
}

const emptyCard = (): MerchantCard => ({ points: 0, claimed: [], history: [] });

export const useMerchantLoyaltyStore = create<State>()(
  persist(
    (set, get) => ({
      // Vide au premier lancement : on ne montre pas de points qu'on n'a pas gagnés.
      cards: {},
      programs: {},
      rewards: [],

      saveProgram: (merchantId, program) =>
        set((s) => ({
          programs: {
            ...s.programs,
            [merchantId]: {
              // En ligne = unité figée (CDC V1.1).
              unit: s.programs[merchantId]?.unit ?? program.unit,
              tiers: program.tiers.slice(0, 4).map((t, i) => ({ ...t, rank: i + 1 })),
            },
          },
        })),

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

      claim: (merchantId, rank, merchantName = '') => {
        const card = get().cards[merchantId];
        // Les paliers de CE commerçant : réclamer suit son barème en vigueur.
        const tier = programOf(get().programs, merchantId).tiers.find((t) => t.rank === rank);
        if (!card || !tier) return false;
        if (card.claimed.includes(rank) || card.points < tier.cost) return false;
        set((s) => ({
          cards: {
            ...s.cards,
            [merchantId]: { ...card, claimed: [...card.claimed, rank] },
          },
          rewards: [
            {
              id: `rw_${Date.now()}_${rank}`,
              merchantId,
              merchantName,
              rank,
              label: tier.reward,
              code: rewardCode(),
              status: 'disponible' as const,
              at: Date.now(),
            },
            ...s.rewards,
          ],
        }));
        return true;
      },

      shareReward: (rewardId) => {
        const reward = get().rewards.find((r) => r.id === rewardId);
        if (!reward || reward.status !== 'disponible') return false;
        set((s) => ({
          rewards: s.rewards.map((r) =>
            r.id === rewardId ? { ...r, status: 'partagee' as const } : r,
          ),
        }));
        return true;
      },

      redeemReward: (merchantId, code) => {
        const wanted = code.trim().toUpperCase();
        const reward = get().rewards.find((r) => r.merchantId === merchantId && r.code === wanted);
        if (!reward) return { ok: false as const, reason: 'inconnu' as const };
        if (reward.status !== 'disponible') {
          return { ok: false as const, reason: 'deja_utilisee' as const };
        }
        set((s) => ({
          rewards: s.rewards.map((r) =>
            r.id === reward.id ? { ...r, status: 'utilisee' as const } : r,
          ),
        }));
        return { ok: true as const, reward: { ...reward, status: 'utilisee' as const } };
      },

      resetDemo: () => set({ cards: seedCards(), programs: {}, rewards: [] }),
    }),
    {
      name: 'tklink-merchant-loyalty-v1',
      storage: createJSONStorage(() => asyncStorageBackend),
      // Les programmes se persistent avec les cartes : un barème reconfiguré ne
      // doit pas revenir à celui par défaut au prochain lancement.
      partialize: (s) => ({ cards: s.cards, programs: s.programs, rewards: s.rewards }),
      merge: (persisted, current) => {
        const parsed = PersistedSchema.safeParse(persisted);
        return parsed.success ? { ...current, ...parsed.data } : current;
      },
    },
  ),
);

/* ---- sélecteurs : tranche brute uniquement ---- */
export const selectCards = (s: State) => s.cards;
export const selectPrograms = (s: State) => s.programs;
export const selectRewards = (s: State) => s.rewards;

/** Le programme en vigueur chez un commerçant (celui par défaut s'il n'a rien réglé). */
export function programOf(programs: Record<string, Program>, merchantId: string): Program {
  return programs[merchantId] ?? DEFAULT_PROGRAM;
}
