import { supabase } from '@/shared/lib/supabase';

import { makeDemoSession } from '../model/demo-session';
import * as service from '../model/service';
import { appleIdentity } from '../model/social/apple';
import { googleIdentity, googleSignOut } from '../model/social/google';
import { useAuthStore } from '../model/store';

/**
 * Le store quand un VRAI serveur est branché : `isSupabaseConfigured` vaut `true`, et le service
 * (la frontière avec Supabase) est simulé. On vérifie ici les décisions du store — validation locale
 * avant tout appel réseau, catégorie d'erreur gardée en état, enchaînement Google/Apple, nettoyage
 * à la déconnexion — pas le serveur lui-même (voir `service.test.ts`).
 */
jest.mock('@/shared/lib/env', () => ({
  ...jest.requireActual('@/shared/lib/env'),
  isSupabaseConfigured: true,
  isPhoneAuthEnabled: true,
}));
jest.mock('@/shared/lib/supabase', () => ({
  supabase: { auth: { getSession: jest.fn(), onAuthStateChange: jest.fn() } },
}));
jest.mock('../model/service');
jest.mock('../model/social/google');
jest.mock('../model/social/apple');

const svc = jest.mocked(service);
const google = jest.mocked(googleIdentity);
const apple = jest.mocked(appleIdentity);
const googleOut = jest.mocked(googleSignOut);
const state = () => useAuthStore.getState();

const aSession = makeDemoSession('neo@exemple.fr');

beforeEach(() => {
  jest.resetAllMocks();
  useAuthStore.setState({ session: null, status: 'unauthenticated', error: null });
});

describe('mode réel', () => {
  it('n’est pas en démonstration', () => {
    expect(state().demoMode).toBe(false);
  });
});

describe('connexion', () => {
  it('par e-mail : normalisé, puis envoyé au service', async () => {
    svc.signInWithPassword.mockResolvedValue({ ok: true });
    expect(await state().signIn('  Neo@Exemple.FR ', 'motdepasse1')).toEqual({ ok: true });
    expect(svc.signInWithPassword).toHaveBeenCalledWith(
      { kind: 'email', value: 'neo@exemple.fr' },
      'motdepasse1',
    );
  });

  it('par téléphone : converti en E.164 avant d’être envoyé', async () => {
    svc.signInWithPassword.mockResolvedValue({ ok: true });
    await state().signIn('06 12 34 56 78', 'motdepasse1');
    expect(svc.signInWithPassword).toHaveBeenCalledWith(
      { kind: 'phone', value: '+33612345678' },
      'motdepasse1',
    );
  });

  it('refuse une saisie invalide SANS appeler le serveur', async () => {
    expect(await state().signIn('pas-un-identifiant', 'motdepasse1')).toEqual({
      ok: false,
      error: 'invalid_input',
    });
    expect(await state().signIn('neo@exemple.fr', 'court')).toEqual({
      ok: false,
      error: 'invalid_input',
    });
    expect(svc.signInWithPassword).not.toHaveBeenCalled();
    expect(state().status).toBe('unauthenticated');
  });

  it('garde la catégorie de l’échec en état, puis l’efface au succès suivant', async () => {
    svc.signInWithPassword.mockResolvedValueOnce({ ok: false, code: 'invalid_credentials' });
    expect(await state().signIn('neo@exemple.fr', 'motdepasse1')).toEqual({
      ok: false,
      error: 'invalid_credentials',
    });
    expect(state().error).toBe('invalid_credentials');

    svc.signInWithPassword.mockResolvedValueOnce({ ok: true });
    await state().signIn('neo@exemple.fr', 'motdepasse1');
    expect(state().error).toBeNull();
  });

  it('n’invente pas de session : c’est l’écoute de Supabase qui l’ouvre', async () => {
    svc.signInWithPassword.mockResolvedValue({ ok: true });
    await state().signIn('neo@exemple.fr', 'motdepasse1');
    expect(state().session).toBeNull();
  });
});

describe('inscription', () => {
  it('transmet le profil et dit si un code est à saisir', async () => {
    svc.signUpWithEmail.mockResolvedValue({ ok: true, needsCode: true });
    const meta = {
      firstName: 'Neo',
      lastName: 'Démo',
      phone: '+33612345678',
      accountType: 'consommateur' as const,
    };
    expect(await state().signUp('Neo@Exemple.fr', 'motdepasse1', meta)).toEqual({
      ok: true,
      needsCode: true,
    });
    expect(svc.signUpWithEmail).toHaveBeenCalledWith('neo@exemple.fr', 'motdepasse1', meta);
  });

  it('refuse un e-mail ou un mot de passe invalide avant le réseau', async () => {
    expect(await state().signUp('pas-un-email', 'motdepasse1')).toEqual({
      ok: false,
      error: 'invalid_input',
    });
    expect(await state().signUp('neo@exemple.fr', '1234567')).toEqual({
      ok: false,
      error: 'invalid_input',
    });
    expect(svc.signUpWithEmail).not.toHaveBeenCalled();
  });

  it('un compte existant est une catégorie à part', async () => {
    svc.signUpWithEmail.mockResolvedValue({ ok: false, code: 'user_exists' });
    expect(await state().signUp('neo@exemple.fr', 'motdepasse1')).toEqual({
      ok: false,
      error: 'user_exists',
    });
  });

  it('confirme avec un code à six chiffres, rien d’autre n’est envoyé', async () => {
    svc.confirmSignUp.mockResolvedValue({ ok: true });
    expect(await state().confirmSignUp('neo@exemple.fr', '12345')).toEqual({
      ok: false,
      error: 'invalid_input',
    });
    expect(await state().confirmSignUp('neo@exemple.fr', 'abcdef')).toEqual({
      ok: false,
      error: 'invalid_input',
    });
    expect(svc.confirmSignUp).not.toHaveBeenCalled();

    expect(await state().confirmSignUp('neo@exemple.fr', '123456')).toEqual({ ok: true });
    expect(svc.confirmSignUp).toHaveBeenCalledWith('neo@exemple.fr', '123456');
  });
});

describe('numéro de téléphone', () => {
  it('exige une session : on ne sait pas à qui rattacher le numéro sinon', async () => {
    expect(await state().startPhoneVerification('06 12 34 56 78')).toEqual({
      ok: false,
      error: 'session_missing',
    });
    expect(svc.startPhoneVerification).not.toHaveBeenCalled();
  });

  it('envoie le numéro en E.164 une fois connecté', async () => {
    useAuthStore.setState({ session: aSession, status: 'authenticated' });
    svc.startPhoneVerification.mockResolvedValue({ ok: true });
    expect(await state().startPhoneVerification('06 12 34 56 78')).toEqual({ ok: true });
    expect(svc.startPhoneVerification).toHaveBeenCalledWith('+33612345678');
  });

  it('refuse un numéro invalide et un code mal formé', async () => {
    useAuthStore.setState({ session: aSession, status: 'authenticated' });
    expect(await state().startPhoneVerification('123')).toEqual({
      ok: false,
      error: 'invalid_input',
    });
    expect(await state().confirmPhone('06 12 34 56 78', '12')).toEqual({
      ok: false,
      error: 'invalid_input',
    });
    expect(svc.startPhoneVerification).not.toHaveBeenCalled();
    expect(svc.confirmPhone).not.toHaveBeenCalled();
  });

  it('confirme avec le code', async () => {
    svc.confirmPhone.mockResolvedValue({ ok: true });
    expect(await state().confirmPhone('06 12 34 56 78', '123456')).toEqual({ ok: true });
    expect(svc.confirmPhone).toHaveBeenCalledWith('+33612345678', '123456');
  });
});

describe('mot de passe oublié', () => {
  it('rend l’identifiant normalisé, pour les étapes suivantes', async () => {
    svc.requestPasswordReset.mockResolvedValue({ ok: true });
    expect(await state().requestPasswordReset('06 12 34 56 78')).toEqual({
      ok: true,
      identifier: { kind: 'phone', value: '+33612345678' },
    });
    expect(svc.requestPasswordReset).toHaveBeenCalledWith({ kind: 'phone', value: '+33612345678' });
  });

  it('vérifie le code puis change le mot de passe — dans cet ordre', async () => {
    svc.verifyPasswordReset.mockResolvedValue({ ok: true });
    svc.setPassword.mockResolvedValue({ ok: true });

    // Pas de session tant que le code n'est pas vérifié : le changement est refusé.
    expect(await state().setNewPassword('nouveau-mdp-1')).toEqual({
      ok: false,
      error: 'session_missing',
    });

    expect(
      await state().verifyResetCode({ kind: 'email', value: 'neo@exemple.fr' }, '123456'),
    ).toEqual({ ok: true });
    useAuthStore.setState({ session: aSession, status: 'authenticated' });
    expect(await state().setNewPassword('nouveau-mdp-1')).toEqual({ ok: true });
    expect(svc.setPassword).toHaveBeenCalledWith('nouveau-mdp-1');
  });

  it('refuse un nouveau mot de passe trop court sans appeler le serveur', async () => {
    useAuthStore.setState({ session: aSession, status: 'authenticated' });
    expect(await state().setNewPassword('court')).toEqual({ ok: false, error: 'weak_password' });
    expect(svc.setPassword).not.toHaveBeenCalled();
  });
});

describe('Google et Apple', () => {
  it('Google : la fenêtre, puis le jeton remis à Supabase', async () => {
    google.mockResolvedValue({
      ok: true,
      idToken: 'jeton-google',
      firstName: 'Sofia',
      lastName: 'Rey',
    });
    svc.signInWithIdToken.mockResolvedValue({ ok: true, isNewUser: true, userId: 'u1' });

    expect(await state().signInWithGoogle()).toEqual({
      ok: true,
      isNewUser: true,
      firstName: 'Sofia',
      lastName: 'Rey',
    });
    expect(svc.signInWithIdToken).toHaveBeenCalledWith(
      'google',
      expect.objectContaining({ idToken: 'jeton-google' }),
    );
    expect(svc.rememberName).toHaveBeenCalledWith('u1', { firstName: 'Sofia', lastName: 'Rey' });
  });

  it('Google : un compte existant n’est pas réécrit à chaque connexion', async () => {
    google.mockResolvedValue({ ok: true, idToken: 'jeton', firstName: 'Sofia', lastName: 'Rey' });
    svc.signInWithIdToken.mockResolvedValue({ ok: true, isNewUser: false, userId: 'u1' });
    await state().signInWithGoogle();
    expect(svc.rememberName).not.toHaveBeenCalled();
  });

  it('Apple : le nom, donné une seule fois, est rangé aussitôt, et le nonce suit', async () => {
    apple.mockResolvedValue({
      ok: true,
      idToken: 'jeton-apple',
      nonce: 'nonce-brut',
      firstName: 'Sofia',
    });
    svc.signInWithIdToken.mockResolvedValue({ ok: true, isNewUser: false, userId: 'u1' });

    await state().signInWithApple();
    expect(svc.signInWithIdToken).toHaveBeenCalledWith(
      'apple',
      expect.objectContaining({ idToken: 'jeton-apple', nonce: 'nonce-brut' }),
    );
    expect(svc.rememberName).toHaveBeenCalledWith('u1', { firstName: 'Sofia', lastName: '' });
  });

  it('Apple sans nom (connexions suivantes) : rien à ranger', async () => {
    apple.mockResolvedValue({ ok: true, idToken: 'jeton-apple', nonce: 'n' });
    svc.signInWithIdToken.mockResolvedValue({ ok: true, isNewUser: false, userId: 'u1' });
    await state().signInWithApple();
    expect(svc.rememberName).not.toHaveBeenCalled();
  });

  it('fermer la fenêtre n’est pas une erreur : rien en état, rien envoyé à Supabase', async () => {
    google.mockResolvedValue({ ok: false, code: 'cancelled' });
    expect(await state().signInWithGoogle()).toEqual({ ok: false, error: 'cancelled' });
    expect(state().error).toBeNull();
    expect(svc.signInWithIdToken).not.toHaveBeenCalled();
  });

  it('un fournisseur indisponible est signalé', async () => {
    apple.mockResolvedValue({ ok: false, code: 'unavailable' });
    expect(await state().signInWithApple()).toEqual({ ok: false, error: 'unavailable' });
    expect(state().error).toBe('unavailable');
  });

  it('un refus de Supabase (fournisseur désactivé, jeton rejeté) est classé', async () => {
    google.mockResolvedValue({ ok: true, idToken: 'jeton' });
    svc.signInWithIdToken.mockResolvedValue({ ok: false, code: 'provider_disabled' });
    expect(await state().signInWithGoogle()).toEqual({ ok: false, error: 'provider_disabled' });
  });
});

describe('session', () => {
  it('se déconnecter oublie le compte Google, ferme la session et la vide', async () => {
    useAuthStore.setState({ session: aSession, status: 'authenticated' });
    await state().signOut();
    expect(googleOut).toHaveBeenCalledWith();
    expect(svc.signOut).toHaveBeenCalled();
    expect(state().session).toBeNull();
    expect(state().status).toBe('unauthenticated');
  });

  it('supprimer le compte : la session reste si le serveur refuse', async () => {
    useAuthStore.setState({ session: aSession, status: 'authenticated' });
    svc.deleteAccount.mockResolvedValue({ ok: false, code: 'network' });
    expect(await state().deleteAccount()).toEqual({ ok: false, error: 'network' });
    expect(state().status).toBe('authenticated');
    expect(googleOut).not.toHaveBeenCalled();
  });

  it('supprimer le compte : révoque Google, ferme la session et la vide', async () => {
    useAuthStore.setState({ session: aSession, status: 'authenticated' });
    svc.deleteAccount.mockResolvedValue({ ok: true });
    expect(await state().deleteAccount()).toEqual({ ok: true });
    expect(googleOut).toHaveBeenCalledWith({ revoke: true });
    expect(svc.signOut).toHaveBeenCalled();
    expect(state().status).toBe('unauthenticated');
  });

  it('init relit la session enregistrée et suit ses changements', async () => {
    const unsubscribe = jest.fn();
    let listener: (event: string, session: unknown) => void = () => {};
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: aSession } });
    (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation((cb) => {
      listener = cb;
      return { data: { subscription: { unsubscribe } } };
    });

    const stop = state().init();
    await Promise.resolve();
    await Promise.resolve();
    expect(state().status).toBe('authenticated');

    listener('SIGNED_OUT', null);
    expect(state().status).toBe('unauthenticated');
    expect(state().session).toBeNull();

    stop();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
