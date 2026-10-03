import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { z } from 'zod';

import { asyncStorageBackend } from '@/shared/lib/storage';

/**
 * Le mode d'affichage choisi — « Nuit / Jour » des maquettes du client.
 *
 * `system` suit le réglage du téléphone. Par défaut la NUIT : c'est l'identité
 * de la marque (rose fluo sur noir), et le premier mode que le client montre.
 * Rien de sensible : le niveau en clair suffit.
 */
export const THEME_MODES = ['night', 'day', 'system'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

const PersistedSchema = z.object({ mode: z.enum(THEME_MODES).default('night') });

type ThemeState = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'night',
      setMode: (mode) => set({ mode }),
    }),
    {
      name: 'tklink-theme-v1',
      storage: createJSONStorage(() => asyncStorageBackend),
      partialize: (s) => ({ mode: s.mode }),
      // Un état illisible ne doit jamais empêcher d'ouvrir l'app.
      merge: (persisted, current) => {
        const parsed = PersistedSchema.safeParse(persisted);
        return parsed.success ? { ...current, ...parsed.data } : current;
      },
    },
  ),
);

export const selectThemeMode = (s: ThemeState) => s.mode;
