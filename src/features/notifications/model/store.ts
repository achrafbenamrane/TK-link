import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { isSupabaseConfigured } from '@/shared/lib/env';
import { asyncStorageBackend } from '@/shared/lib/storage';

import { registerToken, unregisterToken } from '../lib/token-api';
import { getExpoPushToken } from '../lib/push';
import { PersistedSchema } from './schema';

export type PushStatus = 'idle' | 'registered' | 'denied' | 'unavailable' | 'error';

type PushState = {
  /** Le jeton enregistré au serveur pour CE téléphone (à retirer à la déconnexion). */
  token: string | null;
  status: PushStatus;
  /** Demande l’autorisation, récupère le jeton et l’enregistre pour le compte connecté. */
  register: () => Promise<void>;
  /** Retire ce téléphone du compte connecté. À appeler AVANT de fermer la session. */
  forget: () => Promise<void>;
};

/**
 * LES NOTIFICATIONS DE CE TÉLÉPHONE. Le jeton n’est pas un secret (il ne permet que de recevoir) :
 * stockage ordinaire. Il est gardé pour pouvoir le retirer du compte à la déconnexion — sinon le
 * téléphone recevrait encore les commandes de la personne précédente.
 */
export const usePushStore = create<PushState>()(
  persist(
    (set, get) => ({
      token: null,
      status: 'idle',

      register: async () => {
        if (!isSupabaseConfigured) return;
        const res = await getExpoPushToken();
        if (!res.ok) {
          set({ status: res.reason });
          return;
        }
        const saved = await registerToken(res.token, res.platform);
        set(saved ? { token: res.token, status: 'registered' } : { status: 'error' });
      },

      forget: async () => {
        const { token } = get();
        if (token) await unregisterToken(token);
        set({ token: null, status: 'idle' });
      },
    }),
    {
      name: 'tklink-push-v1',
      storage: createJSONStorage(() => asyncStorageBackend),
      partialize: (s) => ({ token: s.token }),
      merge: (persisted, current) => {
        const parsed = PersistedSchema.safeParse(persisted);
        return parsed.success ? { ...current, ...parsed.data } : current;
      },
    },
  ),
);

export const selectPushStatus = (s: PushState) => s.status;
