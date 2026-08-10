import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { z } from 'zod';

import { asyncStorageBackend } from '@/shared/lib/storage';

import { chestAvailable, rollChest, type ChestReward } from '../lib/chest';
import {
  bumpStreak,
  dayKey,
  EMPTY_COUNTS,
  XP,
  type DailyCounts,
  type MissionKind,
  type XpSource,
} from '../lib/progression';

/**
 * L'état du chasseur : XP, série, compteurs du jour.
 *
 * ⚠️ ZUSTAND v5 : sélecteurs abonnés = tranche brute ou primitive uniquement.
 */

const PersistedSchema = z.object({
  xp: z.number().int().nonnegative().default(0),
  streakCount: z.number().int().nonnegative().default(0),
  streakLastDay: z.string().nullable().default(null),
  /** Jour des compteurs ci-dessous ; sert à les remettre à zéro à minuit. */
  countsDay: z.string().nullable().default(null),
  counts: z
    .object({
      catch: z.number().int().nonnegative().default(0),
      game: z.number().int().nonnegative().default(0),
      visit: z.number().int().nonnegative().default(0),
    })
    .default({ catch: 0, game: 0, visit: 0 }),
  /** Dernier coffre ouvert — un seul par jour civil. */
  lastChest: z
    .object({
      tier: z.enum(['bronze', 'argent', 'or']),
      label: z.string(),
      xp: z.number().int().nonnegative(),
      points: z.number().int().nonnegative(),
      day: z.string(),
    })
    .nullable()
    .default(null),
});

type State = {
  xp: number;
  streakCount: number;
  streakLastDay: string | null;
  countsDay: string | null;
  counts: DailyCounts;
  /** Le dernier coffre ouvert, gardé pour l'afficher jusqu'au lendemain. */
  lastChest: ChestReward | null;

  /**
   * Enregistre une action : crédite l'XP, avance la série, incrémente le
   * compteur du jour. Les compteurs se remettent à zéro au changement de jour —
   * ici, pas par une tâche de fond qui ne tournerait jamais si l'app est fermée.
   */
  record: (source: XpSource, nowMs?: number) => void;
  /** Première ouverture du jour : ne compte qu'une fois. */
  markVisit: (nowMs?: number) => void;
  /**
   * Ouvre le coffre du jour. Renvoie la récompense, ou `null` si le coffre a
   * déjà été ouvert aujourd'hui — c'est le STORE qui tranche, pas l'écran :
   * une garde côté UI se contournerait en revenant sur l'onglet.
   */
  openChest: (nowMs?: number) => ChestReward | null;
  resetDemo: () => void;
};

/** Quelle mission avance pour une source d'XP donnée. */
const KIND_OF: Partial<Record<XpSource, MissionKind>> = {
  catch: 'catch',
  game: 'game',
  visit: 'visit',
};

export const useGameStore = create<State>()(
  persist(
    (set, get) => ({
      xp: 0,
      streakCount: 0,
      streakLastDay: null,
      countsDay: null,
      counts: EMPTY_COUNTS,
      lastChest: null,

      record: (source, nowMs = Date.now()) => {
        const s = get();
        const today = dayKey(nowMs);
        // Jour nouveau → compteurs remis à zéro avant d'incrémenter.
        const base = s.countsDay === today ? s.counts : EMPTY_COUNTS;
        const kind = KIND_OF[source];
        const streak = bumpStreak({ count: s.streakCount, lastDay: s.streakLastDay }, nowMs);

        set({
          xp: s.xp + XP[source],
          streakCount: streak.count,
          streakLastDay: streak.lastDay,
          countsDay: today,
          counts: kind ? { ...base, [kind]: base[kind] + 1 } : base,
        });
      },

      markVisit: (nowMs = Date.now()) => {
        const s = get();
        const today = dayKey(nowMs);
        // Déjà compté aujourd'hui : on ne récompense pas le rafraîchissement.
        if (s.countsDay === today && s.counts.visit > 0) return;
        get().record('visit', nowMs);
      },

      openChest: (nowMs = Date.now()) => {
        const s = get();
        const today = dayKey(nowMs);
        if (!chestAvailable(s.lastChest?.day ?? null, today)) return null;

        // La graine mélange le jour et l'XP : deux joueurs n'ont pas le même
        // tirage, et le même joueur ne peut pas rejouer le sien.
        const tier = rollChest(nowMs - (nowMs % 86_400_000) + s.xp);
        const reward: ChestReward = {
          tier: tier.key,
          label: tier.label,
          xp: tier.xp,
          points: tier.points,
          day: today,
        };
        const streak = bumpStreak({ count: s.streakCount, lastDay: s.streakLastDay }, nowMs);

        set({
          xp: s.xp + reward.xp,
          streakCount: streak.count,
          streakLastDay: streak.lastDay,
          lastChest: reward,
        });
        return reward;
      },

      resetDemo: () =>
        set({
          xp: 0,
          streakCount: 0,
          streakLastDay: null,
          countsDay: null,
          counts: EMPTY_COUNTS,
          lastChest: null,
        }),
    }),
    {
      name: 'tklink-gamification-v1',
      storage: createJSONStorage(() => asyncStorageBackend),
      partialize: (s) => ({
        xp: s.xp,
        streakCount: s.streakCount,
        streakLastDay: s.streakLastDay,
        countsDay: s.countsDay,
        counts: s.counts,
        lastChest: s.lastChest,
      }),
      merge: (persisted, current) => {
        const parsed = PersistedSchema.safeParse(persisted);
        return parsed.success ? { ...current, ...parsed.data } : current;
      },
    },
  ),
);

/* ---- sélecteurs : primitives ou tranche brute ---- */
export const selectXp = (s: State) => s.xp;
export const selectStreak = (s: State) => s.streakCount;
export const selectCounts = (s: State) => s.counts;
export const selectLastChest = (s: State) => s.lastChest;
