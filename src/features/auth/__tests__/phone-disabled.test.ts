import { useAuthStore } from '../model/store';

/**
 * `EXPO_PUBLIC_AUTH_PHONE=off` : aucun fournisseur de SMS n'est branché côté Supabase, la connexion
 * par numéro n'est donc pas proposée. On le vérifie ici plutôt que de laisser un numéro partir vers
 * un serveur qui ne pourra jamais envoyer le code.
 */
jest.mock('@/shared/lib/env', () => ({
  ...jest.requireActual('@/shared/lib/env'),
  isPhoneAuthEnabled: false,
}));

beforeEach(() => {
  useAuthStore.setState({ session: null, status: 'unauthenticated', error: null });
});

describe('connexion par téléphone désactivée', () => {
  it('refuse un numéro comme identifiant, sans ouvrir de session', async () => {
    expect(await useAuthStore.getState().signIn('06 12 34 56 78', 'motdepasse1')).toEqual({
      ok: false,
      error: 'invalid_input',
    });
    expect(useAuthStore.getState().status).toBe('unauthenticated');
  });

  it('l’e-mail passe toujours', async () => {
    expect(await useAuthStore.getState().signIn('neo@exemple.fr', 'motdepasse1')).toEqual({
      ok: true,
    });
  });

  it('refuse de rattacher un numéro, et de réinitialiser un mot de passe par SMS', async () => {
    expect(await useAuthStore.getState().startPhoneVerification('06 12 34 56 78')).toEqual({
      ok: false,
      error: 'provider_disabled',
    });
    expect(await useAuthStore.getState().requestPasswordReset('06 12 34 56 78')).toEqual({
      ok: false,
      error: 'invalid_input',
    });
  });
});
