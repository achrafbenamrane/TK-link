import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { z } from 'zod';

import { asyncStorageBackend } from '@/shared/lib/storage';

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
});

type State = {
  xp: number;
  streakCount: number;
  streakLastDay: string | null;
  countsDay: string | null;
  counts: DailyCounts;

  /**
   * Enregistre une action : crédite l'XP, avance la série, incrémente le
   * compteur du jour. Les compteurs se remettent à zéro au changement de jour —
   * ici, pas par une tâche de fond qui ne tournerait jamais si l'app est fermée.
   */
  record: (source: XpSource, nowMs?: number) => void;
  /** Première ouverture du jour : ne compte qu'une fois. */
  markVisit: (nowMs?: number) => void;
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

      resetDemo: () =>
        set({
          xp: 0,
          streakCount: 0,
          streakLastDay: null,
          countsDay: null,
          counts: EMPTY_COUNTS,
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
