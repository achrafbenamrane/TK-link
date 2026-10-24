import type { Session } from '@supabase/supabase-js';

import { secureStorage } from '@/shared/lib/storage';
import { supabase } from '@/shared/lib/supabase';

import { makeDemoSession } from '../model/demo-session';
import * as service from '../model/service';
import { useAuthStore } from '../model/store';

/**
 * `EXPO_PUBLIC_AUTH_PHONE=off` AVEC un vrai serveur branché : aucun numéro ne doit partir vers
 * Supabase — ni comme identifiant, ni pour l'associer au compte, ni automatiquement à la connexion
 * qui suit une inscription avec numéro.
 */
jest.mock('@/shared/lib/env', () => ({
  ...jest.requireActual('@/shared/lib/env'),
  isSupabaseConfigured: true,
  isPhoneAuthEnabled: false,
}));
jest.mock('@/shared/lib/supabase', () => ({
  supabase: { auth: { getSession: jest.fn(), onAuthStateChange: jest.fn() } },
}));
jest.mock('@/shared/lib/storage', () => ({
  secureStorage: { get: jest.fn(), set: jest.fn(), remove: jest.fn() },
}));
jest.mock('../model/service');

const svc = jest.mocked(service);
const secure = jest.mocked(secureStorage);
const state = () => useAuthStore.getState();

/** Une session du serveur (pas celle de la démonstration) ; `contactPhone` : le numéro saisi à l'inscription. */
function serverSession(contactPhone?: string): Session {
  const demo = makeDemoSession('neo@exemple.fr');
  return {
    ...demo,
    access_token: 'jeton-du-serveur',
    user: {
      ...demo.user,
      id: 'u1',
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: contactPhone ? { contact_phone: contactPhone } : {},
    },
  };
}

beforeEach(() => {
  jest.resetAllMocks();
  // `resetAllMocks` efface aussi les implémentations : le stockage resterait sans réponse (undefined).
  secure.get.mockResolvedValue(null);
  secure.set.mockResolvedValue(undefined);
  secure.remove.mockResolvedValue(undefined);
  useAuthStore.setState({ session: null, status: 'unauthenticated', error: null });
});

describe('connexion par téléphone désactivée, serveur branché', () => {
  it('un numéro comme identifiant ne part pas au serveur', async () => {
    expect(await state().signIn('06 12 34 56 78', 'motdepasse1')).toEqual({
      ok: false,
      error: 'invalid_input',
    });
    expect(svc.signInWithPassword).not.toHaveBeenCalled();
  });

  it('associer un numéro est refusé avant tout appel, même connecté', async () => {
    useAuthStore.setState({ session: serverSession(), status: 'authenticated' });
    expect(await state().linkPhone('06 12 34 56 78')).toEqual({
      ok: false,
      error: 'provider_disabled',
    });
    expect(svc.linkPhone).not.toHaveBeenCalled();
  });

  it('le mot de passe oublié par numéro ne part pas au serveur', async () => {
    expect(await state().requestPasswordReset('06 12 34 56 78')).toEqual({
      ok: false,
      error: 'invalid_input',
    });
    expect(svc.requestPasswordReset).not.toHaveBeenCalled();
  });

  it('le numéro saisi à l’inscription n’est pas associé à la connexion', () => {
    jest.useFakeTimers();
    try {
      let listener: (event: string, session: Session | null) => void = () => {};
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null } });
      (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation((cb) => {
        listener = cb;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      });

      const stop = state().init();
      listener('SIGNED_IN', serverSession('+33612345678'));
      jest.runOnlyPendingTimers();
      expect(state().status).toBe('authenticated');
      expect(svc.linkPhone).not.toHaveBeenCalled();
      stop();
    } finally {
      jest.useRealTimers();
    }
  });
});
