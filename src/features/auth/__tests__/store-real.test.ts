import type { Session, User } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { secureStorage } from '@/shared/lib/storage';
import { supabase } from '@/shared/lib/supabase';

import { makeDemoSession } from '../model/demo-session';
import * as service from '../model/service';
import { appleIdentity } from '../model/social/apple';
import { googleIdentity, googleSignOut } from '../model/social/google';
import { useAuthStore } from '../model/store';

/**
 * Le store quand un VRAI serveur est branché : `isSupabaseConfigured` vaut `true`, et le service
 * (la frontière avec Supabase) est simulé. On vérifie ici les décisions du store — validation locale
 * avant tout appel réseau, catégorie d'erreur gardée en état, enchaînement Google/Apple, association
 * du numéro (un seul appel à la fois), profil serveur, nettoyage à la déconnexion — pas le serveur
 * lui-même (voir `service.test.ts`).
 */
jest.mock('@/shared/lib/env', () => ({
  ...jest.requireActual('@/shared/lib/env'),
  isSupabaseConfigured: true,
  isPhoneAuthEnabled: true,
}));
jest.mock('@/shared/lib/supabase', () => ({
  supabase: { auth: { getSession: jest.fn(), onAuthStateChange: jest.fn() } },
}));
// La session de démonstration n'est enregistrée que SANS serveur : on vérifie qu'ici, rien n'y est écrit.
jest.mock('@/shared/lib/storage', () => ({
  secureStorage: { get: jest.fn(), set: jest.fn(), remove: jest.fn() },
}));
jest.mock('../model/service');
jest.mock('../model/social/google');
jest.mock('../model/social/apple');

const svc = jest.mocked(service);
const google = jest.mocked(googleIdentity);
const apple = jest.mocked(appleIdentity);
const googleOut = jest.mocked(googleSignOut);
const secure = jest.mocked(secureStorage);
const state = () => useAuthStore.getState();

/**
 * Une session comme en ouvre le serveur. `makeDemoSession` seule ne suffit pas : le store traite une
 * session de DÉMONSTRATION à part, même quand un serveur est branché (voir le dernier bloc).
 */
function serverSession(user: Partial<User> = {}): Session {
  const demo = makeDemoSession('neo@exemple.fr');
  return {
    ...demo,
    access_token: 'jeton-du-serveur',
    refresh_token: 'jeton-de-renouvellement',
    user: {
      ...demo.user,
      id: 'u1',
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: {},
      ...user,
    },
  };
}

const aSession = serverSession();
const aDemoSession = makeDemoSession('neo@exemple.fr');

/** Une promesse qu'on résout à la main : pour observer le store PENDANT un appel. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  jest.resetAllMocks();
  secure.get.mockResolvedValue(null);
  secure.set.mockResolvedValue(undefined);
  secure.remove.mockResolvedValue(undefined);
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

describe('associer un numéro (sans code)', () => {
  it('exige une session : on ne sait pas à qui rattacher le numéro sinon', async () => {
    expect(await state().linkPhone('06 12 34 56 78')).toEqual({
      ok: false,
      error: 'session_missing',
    });
    expect(svc.linkPhone).not.toHaveBeenCalled();
  });

  it('envoie le numéro en E.164 une fois connecté', async () => {
    useAuthStore.setState({ session: aSession, status: 'authenticated' });
    svc.linkPhone.mockResolvedValue({ ok: true });
    expect(await state().linkPhone('06 12 34 56 78')).toEqual({ ok: true });
    expect(svc.linkPhone).toHaveBeenCalledWith('+33612345678');
  });

  it('refuse un numéro invalide SANS appeler le serveur', async () => {
    useAuthStore.setState({ session: aSession, status: 'authenticated' });
    expect(await state().linkPhone('123')).toEqual({ ok: false, error: 'invalid_input' });
    expect(await state().linkPhone('neo@exemple.fr')).toEqual({
      ok: false,
      error: 'invalid_input',
    });
    expect(svc.linkPhone).not.toHaveBeenCalled();
  });

  it('un refus du serveur (numéro déjà pris) est classé et gardé en état', async () => {
    useAuthStore.setState({ session: aSession, status: 'authenticated' });
    svc.linkPhone.mockResolvedValue({ ok: false, code: 'phone_taken' });
    expect(await state().linkPhone('06 12 34 56 78')).toEqual({ ok: false, error: 'phone_taken' });
    expect(state().error).toBe('phone_taken');
  });

  it('deux demandes simultanées pour le même numéro : UN appel, que les deux attendent', async () => {
    useAuthStore.setState({ session: aSession, status: 'authenticated' });
    const link = deferred<service.Outcome>();
    svc.linkPhone.mockReturnValue(link.promise);

    const first = state().linkPhone('06 12 34 56 78');
    const second = state().linkPhone('+33 6 12 34 56 78');
    expect(svc.linkPhone).toHaveBeenCalledTimes(1);

    link.resolve({ ok: false, code: 'phone_taken' });
    expect(await Promise.all([first, second])).toEqual([
      { ok: false, error: 'phone_taken' },
      { ok: false, error: 'phone_taken' },
    ]);

    // La réponse arrivée, une nouvelle demande repart bien vers le serveur.
    svc.linkPhone.mockResolvedValue({ ok: true });
    expect(await state().linkPhone('06 12 34 56 78')).toEqual({ ok: true });
    expect(svc.linkPhone).toHaveBeenCalledTimes(2);
  });
});

describe('mot de passe oublié (par e-mail)', () => {
  it('normalise l’adresse, l’envoie au service et la rend pour les étapes suivantes', async () => {
    svc.requestPasswordReset.mockResolvedValue({ ok: true });
    expect(await state().requestPasswordReset('  Neo@Exemple.FR ')).toEqual({
      ok: true,
      email: 'neo@exemple.fr',
    });
    expect(svc.requestPasswordReset).toHaveBeenCalledWith('neo@exemple.fr');
  });

  it('refuse un numéro (même quand la connexion par numéro est active) et une saisie invalide', async () => {
    expect(await state().requestPasswordReset('06 12 34 56 78')).toEqual({
      ok: false,
      error: 'invalid_input',
    });
    expect(await state().requestPasswordReset('pas-un-email')).toEqual({
      ok: false,
      error: 'invalid_input',
    });
    expect(svc.requestPasswordReset).not.toHaveBeenCalled();
  });

  it('un e-mail qui n’a pas pu partir est classé et gardé en état', async () => {
    svc.requestPasswordReset.mockResolvedValue({ ok: false, code: 'email_unavailable' });
    expect(await state().requestPasswordReset('neo@exemple.fr')).toEqual({
      ok: false,
      error: 'email_unavailable',
    });
    expect(state().error).toBe('email_unavailable');
  });

  it('vérifie le code reçu par e-mail puis change le mot de passe — dans cet ordre', async () => {
    svc.verifyPasswordReset.mockResolvedValue({ ok: true });
    svc.setPassword.mockResolvedValue({ ok: true });

    // Pas de session tant que le code n'est pas vérifié : le changement est refusé.
    expect(await state().setNewPassword('nouveau-mdp-1')).toEqual({
      ok: false,
      error: 'session_missing',
    });

    expect(await state().verifyResetCode(' Neo@Exemple.FR', '123456')).toEqual({ ok: true });
    expect(svc.verifyPasswordReset).toHaveBeenCalledWith('neo@exemple.fr', '123456');
    useAuthStore.setState({ session: aSession, status: 'authenticated' });
    expect(await state().setNewPassword('nouveau-mdp-1')).toEqual({ ok: true });
    expect(svc.setPassword).toHaveBeenCalledWith('nouveau-mdp-1');
  });

  it('un code mal formé n’est pas envoyé ; un code refusé est classé', async () => {
    expect(await state().verifyResetCode('neo@exemple.fr', '12345')).toEqual({
      ok: false,
      error: 'invalid_input',
    });
    expect(svc.verifyPasswordReset).not.toHaveBeenCalled();

    svc.verifyPasswordReset.mockResolvedValue({ ok: false, code: 'otp_invalid' });
    expect(await state().verifyResetCode('neo@exemple.fr', '000000')).toEqual({
      ok: false,
      error: 'otp_invalid',
    });
    expect(state().error).toBe('otp_invalid');
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
      email: 'sofia@exemple.fr',
    });
    svc.signInWithIdToken.mockResolvedValue({ ok: true, isNewUser: true, userId: 'u1' });

    expect(await state().signInWithGoogle()).toEqual({
      ok: true,
      isNewUser: true,
      firstName: 'Sofia',
      lastName: 'Rey',
      email: 'sofia@exemple.fr',
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

  it('Apple (iPhone) : la feuille native ; le nom, donné une seule fois, est rangé aussitôt, et le nonce suit', async () => {
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
    expect(svc.signInWithAppleWeb).not.toHaveBeenCalled();
  });

  it('Apple sans nom ni adresse (connexions suivantes) : rien à ranger, des champs vides', async () => {
    apple.mockResolvedValue({ ok: true, idToken: 'jeton-apple', nonce: 'n' });
    svc.signInWithIdToken.mockResolvedValue({ ok: true, isNewUser: false, userId: 'u1' });
    expect(await state().signInWithApple()).toEqual({
      ok: true,
      isNewUser: false,
      firstName: '',
      lastName: '',
      email: '',
    });
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

describe('Apple sur Android', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'android');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('passe par la page d’Apple (PKCE), pas par la feuille native', async () => {
    svc.signInWithAppleWeb.mockResolvedValue({
      ok: true,
      isNewUser: true,
      userId: 'u1',
      email: 'relais@privaterelay.appleid.com',
    });
    expect(await state().signInWithApple()).toEqual({
      ok: true,
      isNewUser: true,
      firstName: '',
      lastName: '',
      email: 'relais@privaterelay.appleid.com',
    });
    expect(apple).not.toHaveBeenCalled();
    expect(svc.signInWithIdToken).not.toHaveBeenCalled();
    expect(svc.rememberName).not.toHaveBeenCalled();
  });

  it('page fermée : « annulé », rien en état ; un refus du serveur est classé', async () => {
    svc.signInWithAppleWeb.mockResolvedValueOnce({ ok: false, code: 'cancelled' });
    expect(await state().signInWithApple()).toEqual({ ok: false, error: 'cancelled' });
    expect(state().error).toBeNull();

    svc.signInWithAppleWeb.mockResolvedValueOnce({ ok: false, code: 'provider_disabled' });
    expect(await state().signInWithApple()).toEqual({ ok: false, error: 'provider_disabled' });
    expect(state().error).toBe('provider_disabled');
  });

  it('Google, lui, garde sa fenêtre native', async () => {
    google.mockResolvedValue({ ok: true, idToken: 'jeton-google' });
    svc.signInWithIdToken.mockResolvedValue({ ok: true, isNewUser: false, userId: 'u1' });
    expect(await state().signInWithGoogle()).toMatchObject({ ok: true });
    expect(svc.signInWithIdToken).toHaveBeenCalledWith(
      'google',
      expect.objectContaining({ idToken: 'jeton-google' }),
    );
    expect(svc.signInWithAppleWeb).not.toHaveBeenCalled();
  });
});

describe('profil serveur', () => {
  const undeclared: service.ServerProfile = {
    firstName: 'Sofia',
    lastName: 'Rey',
    accountType: 'consommateur',
    accountTypeDeclared: false,
    onboarded: false,
    interests: [],
  };

  beforeEach(() => {
    useAuthStore.setState({ session: aSession, status: 'authenticated' });
  });

  it('sans session : rien à relire', async () => {
    useAuthStore.setState({ session: null, status: 'unauthenticated' });
    expect(await state().syncProfile('commercant')).toBeNull();
    expect(svc.fetchMyProfile).not.toHaveBeenCalled();
  });

  it('un type déjà déclaré fait foi : il n’est pas redéclaré', async () => {
    svc.fetchMyProfile.mockResolvedValue({
      ok: true,
      profile: { ...undeclared, accountType: 'commercant', accountTypeDeclared: true },
    });
    expect(await state().syncProfile('livreur')).toEqual({
      firstName: 'Sofia',
      lastName: 'Rey',
      accountType: 'commercant',
      declared: true,
      onboarded: false,
      interests: [],
    });
    expect(svc.fetchMyProfile).toHaveBeenCalledWith('u1');
    expect(svc.declareAccountType).not.toHaveBeenCalled();
  });

  it('pas encore déclaré (compte Google ou Apple) : le profil choisi dans l’app est déclaré', async () => {
    svc.fetchMyProfile.mockResolvedValue({ ok: true, profile: undeclared });
    svc.declareAccountType.mockResolvedValue({ ok: true, accountType: 'livreur' });
    expect(await state().syncProfile('livreur')).toEqual({
      firstName: 'Sofia',
      lastName: 'Rey',
      accountType: 'livreur',
      declared: true,
      onboarded: false,
      interests: [],
    });
    expect(svc.declareAccountType).toHaveBeenCalledWith('livreur');
  });

  it('se connecter ne déclare rien (declare: false) : le type reste en blanc, et le dit', async () => {
    svc.fetchMyProfile.mockResolvedValue({ ok: true, profile: undeclared });
    expect(await state().syncProfile('commercant', { declare: false })).toEqual({
      firstName: 'Sofia',
      lastName: 'Rey',
      accountType: 'commercant',
      declared: false,
      onboarded: false,
      interests: [],
    });
    expect(svc.declareAccountType).not.toHaveBeenCalled();
  });

  it('declare: false sur un type déjà déclaré : le type du serveur fait foi', async () => {
    svc.fetchMyProfile.mockResolvedValue({
      ok: true,
      profile: { ...undeclared, accountType: 'grossiste', accountTypeDeclared: true },
    });
    expect(await state().syncProfile('consommateur', { declare: false })).toMatchObject({
      accountType: 'grossiste',
      declared: true,
      onboarded: false,
      interests: [],
    });
    expect(svc.declareAccountType).not.toHaveBeenCalled();
  });

  it('le type EFFECTIF rendu par le serveur l’emporte (déclaré entre-temps ailleurs)', async () => {
    svc.fetchMyProfile.mockResolvedValue({ ok: true, profile: undeclared });
    svc.declareAccountType.mockResolvedValue({ ok: true, accountType: 'commercant' });
    expect(await state().syncProfile('livreur')).toMatchObject({ accountType: 'commercant' });
  });

  it('la déclaration échoue (réseau) : on garde le profil local, pas la valeur par défaut', async () => {
    svc.fetchMyProfile.mockResolvedValue({ ok: true, profile: undeclared });
    svc.declareAccountType.mockResolvedValue({ ok: false, code: 'network' });
    expect(await state().syncProfile('livreur')).toEqual({
      firstName: 'Sofia',
      lastName: 'Rey',
      accountType: 'livreur',
      declared: false,
      onboarded: false,
      interests: [],
    });
  });

  it('lecture impossible, ou aucun profil : null, et rien n’est déclaré', async () => {
    svc.fetchMyProfile.mockResolvedValueOnce({ ok: false, code: 'network' });
    expect(await state().syncProfile('livreur')).toBeNull();
    svc.fetchMyProfile.mockResolvedValueOnce({ ok: true, profile: null });
    expect(await state().syncProfile('livreur')).toBeNull();
    expect(svc.declareAccountType).not.toHaveBeenCalled();
  });
});

describe('session', () => {
  it('se déconnecter : « en attente » aussitôt, puis Google oublié, la session fermée et vidée', async () => {
    useAuthStore.setState({ session: aSession, status: 'authenticated' });
    const forgetGoogle = deferred<void>();
    googleOut.mockReturnValue(forgetGoogle.promise);

    const done = state().signOut();
    // Synchrone, avant le premier `await` : l'écran qui déconnecte peut remettre l'app à zéro
    // juste après, sans que la porte d'entrée ne décide quoi que ce soit entre-temps.
    expect(state().status).toBe('loading');
    expect(svc.signOut).not.toHaveBeenCalled();

    forgetGoogle.resolve();
    await done;
    expect(googleOut).toHaveBeenCalledWith();
    expect(svc.signOut).toHaveBeenCalledTimes(1);
    // Google d'abord, puis la session du serveur.
    expect(googleOut.mock.invocationCallOrder[0]).toBeLessThan(
      svc.signOut.mock.invocationCallOrder[0]!,
    );
    expect(state()).toMatchObject({ session: null, status: 'unauthenticated', error: null });
  });

  it('se déconnecter avec un serveur : la session de démonstration enregistrée est oubliée aussi', async () => {
    useAuthStore.setState({ session: aSession, status: 'authenticated' });
    googleOut.mockResolvedValue(undefined);
    svc.signOut.mockResolvedValue(undefined);
    await state().signOut();
    // Une ancienne démonstration restée sur l'appareil ne doit pas rouvrir de session au lancement.
    expect(secure.remove).toHaveBeenCalledWith('tklink-demo-session-v1');
    expect(svc.signOut).toHaveBeenCalledTimes(1);
  });

  it('se déconnecter : même si la fermeture échoue, jamais bloqué « en attente »', async () => {
    useAuthStore.setState({ session: aSession, status: 'authenticated', error: 'network' });
    svc.signOut.mockRejectedValue(new Error('hors ligne'));
    await state()
      .signOut()
      .catch(() => undefined);
    expect(state()).toMatchObject({ session: null, status: 'unauthenticated', error: null });
  });

  it('supprimer le compte : la session reste si le serveur refuse', async () => {
    useAuthStore.setState({ session: aSession, status: 'authenticated' });
    svc.deleteAccount.mockResolvedValue({ ok: false, code: 'network' });
    expect(await state().deleteAccount()).toEqual({ ok: false, error: 'network' });
    expect(state().status).toBe('authenticated');
    expect(googleOut).not.toHaveBeenCalled();
    expect(svc.signOut).not.toHaveBeenCalled();
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
    // Au lancement, rien n'est encore décidé.
    useAuthStore.setState({ status: 'loading' });

    const stop = state().init();
    await Promise.resolve();
    await Promise.resolve();
    expect(state().status).toBe('authenticated');
    // Avec un serveur, c'est SA session qui fait foi : celle d'une démonstration n'est pas relue.
    expect(secure.get).not.toHaveBeenCalled();

    listener('SIGNED_OUT', null);
    expect(state().status).toBe('unauthenticated');
    expect(state().session).toBeNull();

    stop();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('init : une connexion ouverte pendant la relecture n’est pas écrasée par l’état d’avant', async () => {
    const stored = deferred<{ data: { session: Session | null } }>();
    let listener: (event: string, session: Session | null) => void = () => {};
    (supabase.auth.getSession as jest.Mock).mockReturnValue(stored.promise);
    (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation((cb) => {
      listener = cb;
      return { data: { subscription: { unsubscribe: jest.fn() } } };
    });
    useAuthStore.setState({ status: 'loading' });

    const stop = state().init();
    listener('SIGNED_IN', aSession);
    // La relecture du stockage arrive APRÈS la connexion, avec l'état d'avant (aucune session).
    stored.resolve({ data: { session: null } });
    await Promise.resolve();
    await Promise.resolve();
    expect(state()).toMatchObject({ session: aSession, status: 'authenticated' });

    stop();
  });
});

describe('le numéro saisi à l’inscription, associé à la connexion', () => {
  let listener: (event: string, session: Session | null) => void = () => {};
  let stop: () => void = () => {};
  /** Inscrit avec un numéro (dans ses métadonnées), pas encore associé au compte. */
  const signedUp = (user: Partial<User> = {}) =>
    serverSession({ user_metadata: { contact_phone: '+33612345678' }, ...user });

  beforeEach(async () => {
    jest.useFakeTimers();
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null } });
    (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation((cb) => {
      listener = cb;
      return { data: { subscription: { unsubscribe: jest.fn() } } };
    });
    useAuthStore.setState({ status: 'loading' });
    stop = state().init();
    // La session relue au lancement (aucune) arrive avant les événements simulés.
    await Promise.resolve();
    await Promise.resolve();
  });

  afterEach(() => {
    stop();
    jest.useRealTimers();
  });

  it('part au tour suivant, en E.164 — jamais depuis l’écoute, qui tient le verrou de session', () => {
    svc.linkPhone.mockResolvedValue({ ok: true });
    listener('SIGNED_IN', signedUp());
    expect(state().status).toBe('authenticated');
    expect(svc.linkPhone).not.toHaveBeenCalled();

    jest.runOnlyPendingTimers();
    expect(svc.linkPhone).toHaveBeenCalledTimes(1);
    expect(svc.linkPhone).toHaveBeenCalledWith('+33612345678');
  });

  it('rien quand un numéro est déjà associé au compte', () => {
    listener(
      'SIGNED_IN',
      signedUp({ phone: '33612345678', phone_confirmed_at: '2026-10-24T08:00:00Z' }),
    );
    jest.runOnlyPendingTimers();
    expect(svc.linkPhone).not.toHaveBeenCalled();
  });

  it('rien pour un autre événement, sans numéro, ou pour un numéro qui n’est pas en E.164', () => {
    listener('TOKEN_REFRESHED', signedUp());
    listener('SIGNED_IN', serverSession());
    listener('SIGNED_IN', signedUp({ user_metadata: { contact_phone: '06 12 34 56 78' } }));
    jest.runOnlyPendingTimers();
    expect(svc.linkPhone).not.toHaveBeenCalled();
  });

  it('l’écran d’inscription et l’écoute associent le même numéro en même temps : UN appel', async () => {
    const link = deferred<service.Outcome>();
    svc.linkPhone.mockReturnValue(link.promise);

    listener('SIGNED_IN', signedUp());
    const fromScreen = state().linkPhone('06 12 34 56 78');
    jest.runOnlyPendingTimers();
    expect(svc.linkPhone).toHaveBeenCalledTimes(1);

    link.resolve({ ok: true });
    expect(await fromScreen).toEqual({ ok: true });
  });

  it('l’écoute part d’abord, l’écran demande pendant l’appel : UN appel, que l’écran attend', async () => {
    const link = deferred<service.Outcome>();
    svc.linkPhone.mockReturnValue(link.promise);

    listener('SIGNED_IN', signedUp());
    jest.runOnlyPendingTimers();
    expect(svc.linkPhone).toHaveBeenCalledTimes(1);

    // L'appel de l'écoute est encore en vol : l'écran le rejoint au lieu d'en lancer un second.
    const fromScreen = state().linkPhone('06 12 34 56 78');
    expect(svc.linkPhone).toHaveBeenCalledTimes(1);

    link.resolve({ ok: false, code: 'phone_taken' });
    // L'écran, lui, reçoit le refus de l'appel partagé et le garde en état.
    expect(await fromScreen).toEqual({ ok: false, error: 'phone_taken' });
    expect(state().error).toBe('phone_taken');
    expect(svc.linkPhone).toHaveBeenCalledTimes(1);
  });

  it('un refus de l’association automatique (numéro déjà pris) ne s’affiche pas et ne casse rien', async () => {
    svc.linkPhone.mockResolvedValue({ ok: false, code: 'phone_taken' });

    listener('SIGNED_IN', signedUp());
    expect(() => jest.runOnlyPendingTimers()).not.toThrow();
    expect(svc.linkPhone).toHaveBeenCalledTimes(1);
    // L'appel en arrière-plan se termine…
    for (let i = 0; i < 10; i += 1) await Promise.resolve();

    // … et son refus n'est pas une erreur d'écran : il se verra dans « Mon compte ».
    expect(state().error).toBeNull();
    expect(state()).toMatchObject({
      status: 'authenticated',
      session: { access_token: 'jeton-du-serveur' },
    });

    // L'appel terminé n'est plus « en vol » : une nouvelle demande repart vers le serveur.
    svc.linkPhone.mockResolvedValue({ ok: true });
    expect(await state().linkPhone('06 12 34 56 78')).toEqual({ ok: true });
    expect(svc.linkPhone).toHaveBeenCalledTimes(2);
  });
});

describe('session de démonstration dans une build branchée sur un serveur', () => {
  it('« Démo » par numéro : le numéro est associé à la session, qui n’est pas enregistrée', () => {
    state().openDemo('06 12 34 56 78');
    expect(state().status).toBe('authenticated');
    expect(state().session?.user.phone).toBe('33612345678');
    expect(state().session?.user.phone_confirmed_at).toBeTruthy();
    // Au redémarrage, c'est la session du SERVEUR qui fait foi : rien n'est écrit sur l'appareil.
    expect(secure.set).not.toHaveBeenCalled();
  });

  it('associer un numéro le range dans la session, sans appel au serveur', async () => {
    useAuthStore.setState({
      session: makeDemoSession('neo@exemple.fr', Date.now(), 'google'),
      status: 'authenticated',
    });
    expect(await state().linkPhone('06 12 34 56 78')).toEqual({ ok: true });
    expect(svc.linkPhone).not.toHaveBeenCalled();
    expect(state().session?.user).toMatchObject({
      email: 'neo@exemple.fr',
      phone: '33612345678',
      app_metadata: { provider: 'google' },
    });
    expect(state().session?.user.phone_confirmed_at).toBeTruthy();
    expect(secure.set).not.toHaveBeenCalled();
  });

  it('aucun profil serveur à relire', async () => {
    useAuthStore.setState({ session: aDemoSession, status: 'authenticated' });
    expect(await state().syncProfile('commercant')).toBeNull();
    expect(svc.fetchMyProfile).not.toHaveBeenCalled();
  });

  it('se déconnecter, supprimer le compte : rien à fermer côté serveur', async () => {
    useAuthStore.setState({ session: aDemoSession, status: 'authenticated' });
    await state().signOut();
    expect(state()).toMatchObject({ session: null, status: 'unauthenticated' });

    useAuthStore.setState({ session: aDemoSession, status: 'authenticated' });
    expect(await state().deleteAccount()).toEqual({ ok: true });
    expect(state()).toMatchObject({ session: null, status: 'unauthenticated' });

    expect(googleOut).not.toHaveBeenCalled();
    expect(svc.signOut).not.toHaveBeenCalled();
    expect(svc.deleteAccount).not.toHaveBeenCalled();
  });
});

describe('l’accueil retenu par le compte', () => {
  it('un compte qui a déjà fait l’accueil le dit, avec ses centres d’intérêt', async () => {
    useAuthStore.setState({ session: aSession, status: 'authenticated' });
    svc.fetchMyProfile.mockResolvedValue({
      ok: true,
      profile: {
        firstName: 'Sofia',
        lastName: 'Rey',
        accountType: 'consommateur',
        accountTypeDeclared: true,
        onboarded: true,
        interests: ['mode'],
      },
    });
    expect(await state().syncProfile('consommateur', { declare: false })).toMatchObject({
      onboarded: true,
      interests: ['mode'],
    });
  });

  it('terminer l’accueil l’enregistre sur le compte — pas en démonstration, pas sans session', async () => {
    useAuthStore.setState({ session: aSession, status: 'authenticated' });
    svc.saveOnboarding.mockResolvedValue({ ok: true });
    await state().saveOnboarding(['mode', 'sport']);
    expect(svc.saveOnboarding).toHaveBeenCalledWith('u1', ['mode', 'sport']);

    svc.saveOnboarding.mockClear();
    useAuthStore.setState({ session: null, status: 'unauthenticated' });
    await state().saveOnboarding(['mode']);
    expect(svc.saveOnboarding).not.toHaveBeenCalled();
  });
});
