import { secureStorage } from '@/shared/lib/storage';
import { supabase } from '@/shared/lib/supabase';

import { describeAccount } from '../model/account';
import { DEMO_CODE, isDemoSession } from '../model/demo-session';
import { useAuthStore } from '../model/store';

/**
 * Les parcours quand aucun back-end n'est branché (le cas du client qui teste l'APK) : tout
 * s'enchaîne comme avec un vrai serveur, avec un code de démonstration là où un e-mail en
 * apporterait un, et un numéro associé sans code (comme le fera le serveur, sans SMS).
 * Les tests tournent sans variables Supabase : `demoMode` vaut `true`.
 *
 * Le trousseau du téléphone est simulé en mémoire : la session de démonstration y est rangée, et
 * relue au lancement suivant (voir « d'un lancement à l'autre »).
 */
const mockKeychain = new Map<string, string>();
jest.mock('@/shared/lib/storage', () => ({
  ...jest.requireActual('@/shared/lib/storage'),
  secureStorage: {
    get: jest.fn((key: string) => Promise.resolve(mockKeychain.get(key) ?? null)),
    set: jest.fn((key: string, value: string) => {
      mockKeychain.set(key, value);
      return Promise.resolve();
    }),
    remove: jest.fn((key: string) => {
      mockKeychain.delete(key);
      return Promise.resolve();
    }),
  },
}));

/** La clé sous laquelle la démonstration range sa session (voir `store.ts`). */
const KEY = 'tklink-demo-session-v1';
const keychain = jest.mocked(secureStorage);
const state = () => useAuthStore.getState();

/** Ce que la démonstration a rangé dans le trousseau, tel qu'il sera relu au lancement suivant. */
const saved = (): unknown => {
  const raw = mockKeychain.get(KEY);
  return raw === undefined ? undefined : JSON.parse(raw);
};

/** Laisse aboutir ce qui attend encore : la lecture du trousseau est asynchrone. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Un « redémarrage » : la mémoire de l'app repart de zéro, le trousseau, lui, est resté. */
const relaunch = () => {
  useAuthStore.setState({ session: null, status: 'loading', error: null });
  return state().init();
};

const PROFILE = {
  firstName: 'Neo',
  lastName: 'Test',
  phone: '+33612345678',
  accountType: 'consommateur',
} as const;

beforeEach(() => {
  mockKeychain.clear();
  useAuthStore.setState({ session: null, status: 'unauthenticated', error: null });
});

describe('connexion par téléphone', () => {
  it('ouvre une session de démonstration au nom du numéro, normalisé — et ce numéro est associé', async () => {
    expect(await state().signIn('06 12 34 56 78', 'motdepasse1')).toEqual({ ok: true });
    expect(state().status).toBe('authenticated');
    expect(describeAccount(state().session)).toMatchObject({
      email: null,
      phone: '+33612345678',
      phoneLinked: true,
      provider: 'demo',
    });
  });

  it('refuse un identifiant qui n’est ni un e-mail ni un numéro', async () => {
    expect(await state().signIn('bonjour', 'motdepasse1')).toEqual({
      ok: false,
      error: 'invalid_input',
    });
    expect(state().status).toBe('unauthenticated');
  });
});

describe('inscription', () => {
  it('l’inscription de démonstration n’exige aucun code', async () => {
    expect(await state().signUp('neo@exemple.fr', 'motdepasse1')).toEqual({
      ok: true,
      needsCode: false,
    });
  });

  it('associe tout de suite le numéro saisi, comme le fera le serveur', async () => {
    await state().signUp('neo@exemple.fr', 'motdepasse1', PROFILE);
    expect(describeAccount(state().session)).toMatchObject({
      email: 'neo@exemple.fr',
      phone: '+33612345678',
      phoneLinked: true,
      provider: 'demo',
    });
  });

  it('un numéro absent, ou qui n’est pas au format E.164, n’est pas associé', async () => {
    await state().signUp('neo@exemple.fr', 'motdepasse1', { ...PROFILE, phone: '' });
    expect(describeAccount(state().session)).toMatchObject({ phone: null, phoneLinked: false });

    await state().signUp('neo@exemple.fr', 'motdepasse1', { ...PROFILE, phone: '0612345678' });
    expect(describeAccount(state().session)).toMatchObject({ phone: null, phoneLinked: false });
  });
});

describe('confirmation de l’inscription', () => {
  it('accepte le code de démonstration, et seulement lui', async () => {
    expect(await state().confirmSignUp('neo@exemple.fr', '000000')).toEqual({
      ok: false,
      error: 'otp_invalid',
    });
    expect(state().status).toBe('unauthenticated');
    expect(state().error).toBe('otp_invalid');

    expect(await state().confirmSignUp('neo@exemple.fr', DEMO_CODE)).toEqual({ ok: true });
    expect(state().status).toBe('authenticated');
    expect(isDemoSession(state().session)).toBe(true);
  });

  it('ouvre la session de l’adresse normalisée', async () => {
    await state().confirmSignUp('  Neo@Exemple.FR ', DEMO_CODE);
    expect(state().session?.user.email).toBe('neo@exemple.fr');
  });

  it('refuse un code mal formé avant toute vérification', async () => {
    expect(await state().confirmSignUp('neo@exemple.fr', '12')).toEqual({
      ok: false,
      error: 'invalid_input',
    });
  });
});

describe('associer son numéro (sans code)', () => {
  it('range le numéro dans la session, comme Supabase : sans « + », et confirmé', async () => {
    await state().signIn('neo@exemple.fr', 'motdepasse1');
    expect(describeAccount(state().session)).toMatchObject({ phone: null, phoneLinked: false });

    expect(await state().linkPhone('06 12 34 56 78')).toEqual({ ok: true });

    const user = state().session?.user;
    expect(user?.phone).toBe('33612345678');
    expect(user?.phone_confirmed_at).toEqual(expect.any(String));
    expect(state().status).toBe('authenticated');
    expect(isDemoSession(state().session)).toBe(true);
    expect(describeAccount(state().session)).toMatchObject({
      email: 'neo@exemple.fr',
      phone: '+33612345678',
      phoneLinked: true,
      provider: 'demo',
    });
  });

  it('garde le fournisseur de la session : un compte Google reste un compte Google', async () => {
    await state().signInWithGoogle();
    expect(await state().linkPhone('+33 6 12 34 56 78')).toEqual({ ok: true });
    expect(describeAccount(state().session)).toMatchObject({
      email: 'alex.demo@gmail.com',
      phone: '+33612345678',
      phoneLinked: true,
      provider: 'google',
    });
  });

  it('refuse un numéro invalide, sans toucher à la session', async () => {
    await state().signIn('neo@exemple.fr', 'motdepasse1');
    const before = state().session;

    expect(await state().linkPhone('12 34')).toEqual({ ok: false, error: 'invalid_input' });
    expect(state().error).toBe('invalid_input');
    expect(state().session).toBe(before);
  });

  it('sans session, il n’y a aucun compte auquel l’associer', async () => {
    expect(await state().linkPhone('06 12 34 56 78')).toEqual({
      ok: false,
      error: 'session_missing',
    });
    expect(state().session).toBeNull();
  });
});

describe('mot de passe oublié, par e-mail', () => {
  it('l’adresse, le code, puis le nouveau mot de passe', async () => {
    const requested = await state().requestPasswordReset('neo@exemple.fr');
    expect(requested).toEqual({ ok: true, email: 'neo@exemple.fr' });
    if (!requested.ok) throw new Error('inattendu');

    expect(await state().verifyResetCode(requested.email, '111111')).toEqual({
      ok: false,
      error: 'otp_invalid',
    });
    expect(state().status).toBe('unauthenticated');

    expect(await state().verifyResetCode(requested.email, DEMO_CODE)).toEqual({ ok: true });
    expect(state().status).toBe('authenticated');
    expect(isDemoSession(state().session)).toBe(true);
    expect(state().session?.user.email).toBe('neo@exemple.fr');

    expect(await state().setNewPassword('court')).toEqual({ ok: false, error: 'weak_password' });
    expect(await state().setNewPassword('nouveau-mdp-1')).toEqual({ ok: true });
  });

  it('rend l’adresse normalisée, celle dont le code ouvrira la session', async () => {
    expect(await state().requestPasswordReset('  Neo@Exemple.FR ')).toEqual({
      ok: true,
      email: 'neo@exemple.fr',
    });
    await state().verifyResetCode('Neo@Exemple.FR', DEMO_CODE);
    expect(state().session?.user.email).toBe('neo@exemple.fr');
  });

  it('refuse un numéro de téléphone : la récupération par SMS n’existe pas encore', async () => {
    expect(await state().requestPasswordReset('06 12 34 56 78')).toEqual({
      ok: false,
      error: 'invalid_input',
    });
  });

  it('un identifiant invalide est refusé', async () => {
    expect(await state().requestPasswordReset('???')).toEqual({
      ok: false,
      error: 'invalid_input',
    });
  });

  it('un code mal formé est refusé avant toute vérification', async () => {
    expect(await state().verifyResetCode('neo@exemple.fr', '12')).toEqual({
      ok: false,
      error: 'invalid_input',
    });
    expect(state().status).toBe('unauthenticated');
  });
});

describe('Google et Apple', () => {
  it('ouvrent une session de démonstration marquée du fournisseur, avec l’adresse qu’il donne', async () => {
    expect(await state().signInWithGoogle()).toEqual({
      ok: true,
      isNewUser: true,
      firstName: 'Alex',
      lastName: 'M.',
      email: 'alex.demo@gmail.com',
    });
    expect(describeAccount(state().session)).toMatchObject({
      email: 'alex.demo@gmail.com',
      provider: 'google',
    });

    await state().signOut();
    expect(await state().signInWithApple()).toEqual({
      ok: true,
      isNewUser: true,
      firstName: 'Alex',
      lastName: 'M.',
      email: 'alex.demo@privaterelay.appleid.com',
    });
    expect(describeAccount(state().session)?.provider).toBe('apple');
  });
});

describe('les boutons « Démo » du choix du profil', () => {
  it('ouvrent une session locale au nom de l’adresse', () => {
    state().openDemo('neo.demo@tklink.fr');
    expect(state().status).toBe('authenticated');
    expect(isDemoSession(state().session)).toBe(true);
    expect(describeAccount(state().session)).toMatchObject({
      email: 'neo.demo@tklink.fr',
      phone: null,
      phoneLinked: false,
      provider: 'demo',
    });
  });

  it('un numéro sert d’identifiant : normalisé, et associé', () => {
    state().openDemo('06 12 34 56 78');
    expect(describeAccount(state().session)).toMatchObject({
      email: null,
      phone: '+33612345678',
      phoneLinked: true,
    });
  });
});

describe('le profil du serveur', () => {
  /** Toute lecture de la table `profiles` passerait par ici : en démonstration, aucune ne part. */
  let from: jest.SpyInstance;
  beforeEach(() => {
    from = jest.spyOn(supabase, 'from').mockImplementation(() => {
      throw new Error('aucune requête ne doit partir en démonstration');
    });
  });
  afterEach(() => from.mockRestore());

  it('n’existe pas en démonstration : l’app garde son profil local', async () => {
    await state().signIn('neo@exemple.fr', 'motdepasse1');
    await expect(state().syncProfile('commercant')).resolves.toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it('même une session qui n’a pas l’air d’une démonstration n’interroge aucun serveur', async () => {
    state().openDemo('neo@exemple.fr');
    const session = state().session;
    if (!session) throw new Error('inattendu');
    // Le jeton n'est plus celui de la démonstration : seul le mode du store protège encore.
    useAuthStore.setState({ session: { ...session, access_token: 'un-vrai-jeton' } });
    expect(isDemoSession(state().session)).toBe(false);

    await expect(state().syncProfile('commercant')).resolves.toBeNull();
    expect(from).not.toHaveBeenCalled();
  });
});

describe('d’un lancement à l’autre', () => {
  it('chaque ouverture de session est rangée dans le trousseau — l’identifiant, jamais le mot de passe', async () => {
    state().openDemo('neo.demo@tklink.fr');
    expect(keychain.set).toHaveBeenLastCalledWith(KEY, expect.any(String));
    expect(saved()).toMatchObject({ identifier: 'neo.demo@tklink.fr' });

    await state().signUp('neo@exemple.fr', 'motdepasse1', PROFILE);
    expect(saved()).toMatchObject({ identifier: 'neo@exemple.fr', phone: '+33612345678' });
    expect(mockKeychain.get(KEY)).not.toContain('motdepasse1');

    await state().signIn('06 12 34 56 78', 'motdepasse2');
    expect(saved()).toMatchObject({ identifier: '+33612345678', phone: '+33612345678' });
    expect(mockKeychain.get(KEY)).not.toContain('motdepasse2');
    expect(keychain.set).toHaveBeenCalledTimes(3);
  });

  it('au lancement suivant, init() relit la session : « en attente » d’abord, puis connecté', async () => {
    await state().signInWithGoogle();
    await state().linkPhone('06 12 34 56 78');

    const stop = relaunch();
    // La lecture du trousseau est asynchrone : tant qu'elle n'a pas répondu, la porte attend.
    expect(state().status).toBe('loading');
    expect(state().session).toBeNull();

    await settle();
    expect(keychain.get).toHaveBeenCalledWith(KEY);
    expect(state().status).toBe('authenticated');
    expect(isDemoSession(state().session)).toBe(true);
    expect(describeAccount(state().session)).toMatchObject({
      email: 'alex.demo@gmail.com',
      phone: '+33612345678',
      phoneLinked: true,
      provider: 'google',
    });
    stop();
  });

  it('un enregistrement sans fournisseur se relit comme une session « démo »', async () => {
    mockKeychain.set(KEY, JSON.stringify({ identifier: 'neo@exemple.fr' }));

    const stop = relaunch();
    await settle();
    expect(state().status).toBe('authenticated');
    expect(describeAccount(state().session)).toMatchObject({
      email: 'neo@exemple.fr',
      phone: null,
      phoneLinked: false,
      provider: 'demo',
    });
    stop();
  });

  it('rien d’enregistré : « en attente », puis non connecté', async () => {
    const stop = relaunch();
    expect(state().status).toBe('loading');

    await settle();
    expect(state().status).toBe('unauthenticated');
    expect(state().session).toBeNull();
    stop();
  });

  it.each([
    ['du texte qui n’est pas du JSON', '{pas du json'],
    [
      'un numéro qui n’est pas au format E.164',
      JSON.stringify({ identifier: 'neo@exemple.fr', phone: '0612345678' }),
    ],
    [
      'un fournisseur inconnu',
      JSON.stringify({ identifier: 'neo@exemple.fr', provider: 'facebook' }),
    ],
    ['un identifiant vide', JSON.stringify({ identifier: '' })],
  ])('un enregistrement illisible (%s) ne rouvre rien', async (_label, raw) => {
    mockKeychain.set(KEY, raw);

    const stop = relaunch();
    await settle();
    expect(state().status).toBe('unauthenticated');
    expect(state().session).toBeNull();
    stop();
  });

  it('une connexion ouverte pendant la lecture n’est pas défaite par sa réponse (rien d’enregistré)', async () => {
    const stop = relaunch();
    // La lecture est partie : elle répondra « aucune session ».
    expect(keychain.get).toHaveBeenCalledWith(KEY);
    expect(state().status).toBe('loading');

    state().openDemo('neo@exemple.fr');
    expect(state().status).toBe('authenticated');

    await settle();
    expect(state().status).toBe('authenticated');
    expect(describeAccount(state().session)).toMatchObject({
      email: 'neo@exemple.fr',
      provider: 'demo',
    });
    stop();
  });

  it('ni remplacée par la session enregistrée d’avant', async () => {
    mockKeychain.set(KEY, JSON.stringify({ identifier: 'ancien@exemple.fr', provider: 'google' }));

    const stop = relaunch();
    expect(keychain.get).toHaveBeenCalledWith(KEY);
    state().openDemo('neo@exemple.fr');

    await settle();
    expect(state().status).toBe('authenticated');
    expect(describeAccount(state().session)).toMatchObject({
      email: 'neo@exemple.fr',
      provider: 'demo',
    });
    stop();
  });

  it('une lecture qui répond après le désabonnement ne touche plus au store', async () => {
    mockKeychain.set(KEY, JSON.stringify({ identifier: 'neo@exemple.fr' }));

    const stop = relaunch();
    stop();
    await settle();
    expect(state().session).toBeNull();
    expect(state().status).toBe('loading');
  });

  it('la déconnexion efface la session enregistrée : le lancement suivant n’ouvre rien', async () => {
    await state().signIn('neo@exemple.fr', 'motdepasse1');
    expect(mockKeychain.has(KEY)).toBe(true);

    await state().signOut();
    expect(keychain.remove).toHaveBeenCalledWith(KEY);
    expect(mockKeychain.has(KEY)).toBe(false);
    expect(state().status).toBe('unauthenticated');

    const stop = relaunch();
    await settle();
    expect(state().status).toBe('unauthenticated');
    expect(state().session).toBeNull();
    stop();
  });

  it('la suppression du compte aussi', async () => {
    state().openDemo('neo.demo@tklink.fr');
    expect(mockKeychain.has(KEY)).toBe(true);

    expect(await state().deleteAccount()).toEqual({ ok: true });
    expect(keychain.remove).toHaveBeenCalledWith(KEY);
    expect(mockKeychain.has(KEY)).toBe(false);
    expect(state().session).toBeNull();
  });
});
