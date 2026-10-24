import { useAuthStore } from '../model/store';

/**
 * `EXPO_PUBLIC_AUTH_PHONE=off` : aucun fournisseur de SMS n'est branché côté Supabase, la connexion
 * par numéro n'est donc pas proposée. On le vérifie ici plutôt que de laisser un numéro partir vers
 * un serveur qui ne pourra jamais s'en servir. (Sans serveur : la démonstration. Avec un serveur,
 * voir `phone-disabled-real.test.ts`.)
 */
jest.mock('@/shared/lib/env', () => ({
  ...jest.requireActual('@/shared/lib/env'),
  isPhoneAuthEnabled: false,
}));
// La démonstration enregistre sa session dans le stockage sécurisé : un double, sans trousseau.
// `LargeSecureStore` reste le vrai : le client Supabase (non simulé ici) le crée au chargement.
jest.mock('@/shared/lib/storage', () => ({
  ...jest.requireActual('@/shared/lib/storage'),
  secureStorage: {
    get: jest.fn(() => Promise.resolve(null)),
    set: jest.fn(() => Promise.resolve()),
    remove: jest.fn(() => Promise.resolve()),
  },
}));

const state = () => useAuthStore.getState();

beforeEach(() => {
  useAuthStore.setState({ session: null, status: 'unauthenticated', error: null });
});

describe('connexion par téléphone désactivée', () => {
  it('refuse un numéro comme identifiant, sans ouvrir de session', async () => {
    expect(await state().signIn('06 12 34 56 78', 'motdepasse1')).toEqual({
      ok: false,
      error: 'invalid_input',
    });
    expect(state().status).toBe('unauthenticated');
  });

  it('l’e-mail passe toujours', async () => {
    expect(await state().signIn('neo@exemple.fr', 'motdepasse1')).toEqual({
      ok: true,
    });
  });

  it('refuse d’associer un numéro au compte, connecté ou non', async () => {
    expect(await state().linkPhone('06 12 34 56 78')).toEqual({
      ok: false,
      error: 'provider_disabled',
    });

    // Connecté pour de bon : le refus qui suit ne tient pas à une session absente.
    expect(await state().signIn('neo@exemple.fr', 'motdepasse1')).toEqual({ ok: true });
    expect(state().status).toBe('authenticated');
    expect(await state().linkPhone('06 12 34 56 78')).toEqual({
      ok: false,
      error: 'provider_disabled',
    });
    expect(state().session?.user.phone).toBeFalsy();
    expect(state().error).toBe('provider_disabled');
  });

  it('le mot de passe oublié passe par l’e-mail, jamais par un numéro', async () => {
    expect(await state().requestPasswordReset('06 12 34 56 78')).toEqual({
      ok: false,
      error: 'invalid_input',
    });
    expect(await state().requestPasswordReset(' Neo@Exemple.fr ')).toEqual({
      ok: true,
      email: 'neo@exemple.fr',
    });
  });
});
