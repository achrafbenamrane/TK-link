import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { asyncStorageBackend } from '@/shared/lib/storage';

/**
 * Mémorise si l'utilisateur a déjà vu l'accueil. Aucune donnée sensible → tier
 * clair.
 *
 * `hydrated` distingue « pas encore lu le disque » de « lu, jamais vu ». Sans
 * lui, un utilisateur qui revient verrait clignoter l'accueil le temps que le
 * stockage se charge, parce que la valeur par défaut est `false`.
 */
type WelcomeState = {
  seen: boolean;
  hydrated: boolean;
  markSeen: () => void;
  /** Pour re-tester la démo : remet l'accueil à zéro. */
  reset: () => void;
};

export const useWelcomeStore = create<WelcomeState>()(
  persist(
    (set) => ({
      seen: false,
      hydrated: false,
      markSeen: () => set({ seen: true }),
      reset: () => set({ seen: false }),
    }),
    {
      // La clé change avec la marque : les installations de test reverront donc
      // l'écran de bienvenue UNE fois. Sans utilisateur en production, c'est le
      // prix acceptable pour ne plus traîner l'ancien nom dans le stockage.
      name: 'tklink-welcome-v1',
      storage: createJSONStorage(() => asyncStorageBackend),
      partialize: (s) => ({ seen: s.seen }),
      onRehydrateStorage: () => (state) => {
        // Marque l'hydratation terminée, que le disque ait renvoyé une valeur ou non.
        useWelcomeStore.setState({ hydrated: true });
        void state;
      },
    },
  ),
);
