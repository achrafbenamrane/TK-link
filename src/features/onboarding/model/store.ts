import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { asyncStorageBackend } from '@/shared/lib/storage';

import { toggleInterest } from '../lib/avatar';
import { OnboardingSchema, type Avatar, type Interest, type OnboardingState } from './schema';

/**
 * Ce que l'onboarding a appris de l'utilisateur.
 *
 * Non sensible (prénom, avatar, préférences d'affichage) → stockage applicatif. Rien
 * de tout cela ne mérite le stockage sécurisé, qui est réservé aux secrets.
 */

type Store = OnboardingState & {
  /**
   * Lecture du disque terminée. Distingue « pas encore lu » de « lu, jamais
   * fait » : sans ce drapeau, un utilisateur qui revient verrait clignoter
   * l'onboarding, la valeur par défaut de `completed` étant `false`.
   */
  hydrated: boolean;
  setFirstName: (v: string) => void;
  setAvatar: (a: Avatar) => void;
  setHolderType: (t: OnboardingState['holderType']) => void;
  setMedium: (m: OnboardingState['medium']) => void;
  toggleInterest: (i: Interest) => void;
  setShowEcoImpact: (v: boolean) => void;
  complete: () => void;
  /** Rejouer l'accueil (bouton de démonstration dans le profil). */
  reset: () => void;
};

const initial: OnboardingState = OnboardingSchema.parse({});

export const useOnboardingStore = create<Store>()(
  persist(
    (set) => ({
      ...initial,
      hydrated: false,

      setFirstName: (firstName) => set({ firstName: firstName.slice(0, 24) }),
      setAvatar: (avatar) => set({ avatar }),
      setHolderType: (holderType) => set({ holderType }),
      setMedium: (medium) => set({ medium }),
      toggleInterest: (i) => set((s) => ({ interests: toggleInterest(s.interests, i) })),
      setShowEcoImpact: (showEcoImpact) => set({ showEcoImpact }),
      complete: () => set({ completed: true }),
      reset: () => set({ ...initial }),
    }),
    {
      name: 'tklink-onboarding-v1',
      storage: createJSONStorage(() => asyncStorageBackend),
      partialize: ({
        completed,
        firstName,
        avatar,
        holderType,
        medium,
        interests,
        showEcoImpact,
      }) => ({ completed, firstName, avatar, holderType, medium, interests, showEcoImpact }),
      merge: (persisted, current) => {
        const parsed = OnboardingSchema.safeParse(persisted);
        return parsed.success ? { ...current, ...parsed.data } : current;
      },
      onRehydrateStorage: () => (state) => {
        // Hydratation terminée, que le disque ait renvoyé une valeur ou non.
        useOnboardingStore.setState({ hydrated: true });
        void state;
      },
    },
  ),
);

/* ---- sélecteurs : primitives ou tranches brutes ---- */

export const selectCompleted = (s: Store) => s.completed;
export const selectHydrated = (s: Store) => s.hydrated;
export const selectFirstName = (s: Store) => s.firstName;
export const selectAvatar = (s: Store) => s.avatar;
export const selectInterests = (s: Store) => s.interests;
export const selectHolderType = (s: Store) => s.holderType;
