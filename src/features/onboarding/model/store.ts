import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { asyncStorageBackend } from '@/shared/lib/storage';
import { normalizeSiret, type Role } from '@/shared/lib/roles';

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
  setRole: (r: Role) => void;
  setSiret: (v: string) => void;
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
      // Un commerçant ou un grossiste EST un professionnel : laisser ces deux
      // champs se contredire produirait un « commerçant particulier », et
      // l'audience des cadeaux fidélité (`holderType`) deviendrait fausse.
      setRole: (role) => set(role === 'consommateur' ? { role } : { role, holderType: 'pro' }),
      // Normalisé à l'entrée : on ne veut pas stocker « 443 061 841 00047 » un
      // jour et « 44306184100047 » le lendemain selon la façon dont il a été collé.
      setSiret: (v) => set({ siret: normalizeSiret(v) }),
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
        role,
        siret,
        holderType,
        medium,
        interests,
        showEcoImpact,
      }) => ({
        completed,
        firstName,
        avatar,
        role,
        siret,
        holderType,
        medium,
        interests,
        showEcoImpact,
      }),
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
export const selectRole = (s: Store) => s.role;
export const selectSiret = (s: Store) => s.siret;
export const selectHolderType = (s: Store) => s.holderType;
