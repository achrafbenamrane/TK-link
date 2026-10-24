import { appleIdentity, isAppleAvailable } from '../model/social/apple';
import { googleIdentity, googleSignOut } from '../model/social/google';

/**
 * Les passerelles Google et Apple, contre des modules natifs SIMULÉS (il n'y en a pas sous Jest).
 *
 * Ce qu'on prouve : la bonne configuration part à Google, le nonce d'Apple est bien tiré au hasard
 * puis haché avant d'être donné à Apple (et le nonce BRUT revient à l'appelant pour Supabase), et
 * chaque cas d'échec — fenêtre fermée, services indisponibles, jeton absent — est classé sans jamais
 * laisser fuiter le détail du fournisseur.
 */
jest.mock('@/shared/lib/env', () => {
  const actual = jest.requireActual('@/shared/lib/env');
  return {
    ...actual,
    isGoogleConfigured: true,
    env: {
      ...actual.env,
      EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: '111-web.apps.googleusercontent.com',
      EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: '222-ios.apps.googleusercontent.com',
    },
  };
});

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
    revokeAccess: jest.fn(),
    hasPreviousSignIn: jest.fn(),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  },
  isErrorWithCode: (e: unknown) => typeof (e as { code?: unknown } | null)?.code === 'string',
}));

jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(),
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

jest.mock('expo-crypto', () => ({
  getRandomBytes: jest.fn(() => Uint8Array.from({ length: 32 }, (_, i) => i)),
  digestStringAsync: jest.fn(async (_algo: string, data: string) => `sha256(${data})`),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports -- why: récupérer les doubles déclarés ci-dessus
const G = require('@react-native-google-signin/google-signin').GoogleSignin as Record<
  string,
  jest.Mock
>;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- why: idem
const A = require('expo-apple-authentication') as Record<string, jest.Mock>;

const signed = (over: Record<string, unknown> = {}) => ({
  type: 'success',
  data: {
    idToken: 'jeton-google',
    user: { givenName: 'Sofia', familyName: 'Rey', email: 'sofia@exemple.fr' },
    ...over,
  },
});

beforeEach(() => {
  G.hasPlayServices!.mockReset().mockResolvedValue(true);
  G.signIn!.mockReset();
  G.signOut!.mockReset().mockResolvedValue(null);
  G.revokeAccess!.mockReset().mockResolvedValue(null);
  G.hasPreviousSignIn!.mockReset().mockReturnValue(true);
  A.signInAsync!.mockReset();
  A.isAvailableAsync!.mockReset();
});

describe('Google', () => {
  it('configure Google avec l’identifiant « web » (celui de Supabase) et l’identifiant iOS', async () => {
    G.signIn!.mockResolvedValue(signed());
    await googleIdentity();
    expect(G.configure).toHaveBeenCalledWith({
      webClientId: '111-web.apps.googleusercontent.com',
      iosClientId: '222-ios.apps.googleusercontent.com',
      scopes: ['email', 'profile'],
    });
  });

  it('rend le jeton, le prénom, le nom et l’e-mail', async () => {
    G.signIn!.mockResolvedValue(signed());
    expect(await googleIdentity()).toEqual({
      ok: true,
      idToken: 'jeton-google',
      firstName: 'Sofia',
      lastName: 'Rey',
      email: 'sofia@exemple.fr',
    });
    expect(G.hasPlayServices).toHaveBeenCalledWith({ showPlayServicesUpdateDialog: true });
  });

  it('omet les champs que Google ne donne pas', async () => {
    G.signIn!.mockResolvedValue(
      signed({ user: { givenName: null, familyName: null, email: 'a@b.fr' } }),
    );
    expect(await googleIdentity()).toEqual({ ok: true, idToken: 'jeton-google', email: 'a@b.fr' });
  });

  it('fenêtre fermée : « annulé », pas une erreur', async () => {
    G.signIn!.mockResolvedValue({ type: 'cancelled', data: null });
    expect(await googleIdentity()).toEqual({ ok: false, code: 'cancelled' });

    G.signIn!.mockRejectedValue({ code: 'SIGN_IN_CANCELLED' });
    expect(await googleIdentity()).toEqual({ ok: false, code: 'cancelled' });

    // Un second appui pendant que la fenêtre est ouverte.
    G.signIn!.mockRejectedValue({ code: 'IN_PROGRESS' });
    expect(await googleIdentity()).toEqual({ ok: false, code: 'cancelled' });
  });

  it('services Google Play absents : « indisponible »', async () => {
    G.signIn!.mockRejectedValue({ code: 'PLAY_SERVICES_NOT_AVAILABLE' });
    expect(await googleIdentity()).toEqual({ ok: false, code: 'unavailable' });
  });

  it('un jeton absent ou une erreur inconnue : « inconnu », sans détail', async () => {
    G.signIn!.mockResolvedValue(signed({ idToken: null }));
    expect(await googleIdentity()).toEqual({ ok: false, code: 'unknown' });

    G.signIn!.mockRejectedValue(new Error('DEVELOPER_ERROR: 10 (client SHA-1 secret)'));
    const result = await googleIdentity();
    expect(result).toEqual({ ok: false, code: 'unknown' });
    expect(JSON.stringify(result)).not.toContain('SHA-1');
  });

  it('se déconnecter oublie le compte, mais seulement s’il y en avait un', async () => {
    await googleSignOut();
    expect(G.signOut).toHaveBeenCalledTimes(1);

    G.hasPreviousSignIn!.mockReturnValue(false);
    await googleSignOut();
    expect(G.signOut).toHaveBeenCalledTimes(1);
  });

  it('supprimer le compte révoque l’autorisation donnée à l’app', async () => {
    await googleSignOut({ revoke: true });
    expect(G.revokeAccess).toHaveBeenCalledTimes(1);
  });

  it('une erreur à la déconnexion ne bloque jamais la déconnexion', async () => {
    G.signOut!.mockRejectedValue(new Error('hors ligne'));
    await expect(googleSignOut()).resolves.toBeUndefined();
  });
});

describe('Apple', () => {
  it('n’est proposé que si le système le permet', async () => {
    A.isAvailableAsync!.mockResolvedValue(true);
    expect(await isAppleAvailable()).toBe(true);
    A.isAvailableAsync!.mockResolvedValue(false);
    expect(await isAppleAvailable()).toBe(false);
    A.isAvailableAsync!.mockRejectedValue(new Error('x'));
    expect(await isAppleAvailable()).toBe(false);
  });

  it('donne à Apple l’EMPREINTE du nonce, et rend le nonce BRUT pour Supabase', async () => {
    A.signInAsync!.mockResolvedValue({
      identityToken: 'jeton-apple',
      fullName: { givenName: 'Sofia', familyName: 'Rey' },
      email: 'relais@privaterelay.appleid.com',
    });
    const result = await appleIdentity();

    // 32 octets 0..31 en hexadécimal.
    const raw = Array.from({ length: 32 }, (_, i) => i.toString(16).padStart(2, '0')).join('');
    expect(result).toEqual({
      ok: true,
      idToken: 'jeton-apple',
      nonce: raw,
      firstName: 'Sofia',
      lastName: 'Rey',
      email: 'relais@privaterelay.appleid.com',
    });
    expect(A.signInAsync).toHaveBeenCalledWith({
      requestedScopes: [0, 1],
      // Ce qu'Apple reçoit est l'empreinte, jamais le nonce brut.
      nonce: `sha256(${raw})`,
    });
  });

  it('un nouveau nonce à chaque connexion', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- why: le double de expo-crypto
    const crypto = require('expo-crypto') as { getRandomBytes: jest.Mock };
    A.signInAsync!.mockResolvedValue({ identityToken: 't', fullName: null, email: null });
    const first = await appleIdentity();
    crypto.getRandomBytes.mockReturnValueOnce(Uint8Array.from({ length: 32 }, () => 255));
    const second = await appleIdentity();
    expect(first.ok && second.ok && first.nonce !== second.nonce).toBe(true);
  });

  it('sans nom (connexions suivantes), n’invente pas de champ', async () => {
    A.signInAsync!.mockResolvedValue({ identityToken: 'jeton', fullName: null, email: null });
    const result = await appleIdentity();
    expect(result).toMatchObject({ ok: true, idToken: 'jeton' });
    expect(result).not.toHaveProperty('firstName');
    expect(result).not.toHaveProperty('email');
  });

  it('feuille fermée : « annulé »', async () => {
    A.signInAsync!.mockRejectedValue({ code: 'ERR_REQUEST_CANCELED' });
    expect(await appleIdentity()).toEqual({ ok: false, code: 'cancelled' });
  });

  it('jeton absent ou erreur inconnue : « inconnu »', async () => {
    A.signInAsync!.mockResolvedValue({ identityToken: null, fullName: null, email: null });
    expect(await appleIdentity()).toEqual({ ok: false, code: 'unknown' });
    A.signInAsync!.mockRejectedValue({ code: 'ERR_REQUEST_FAILED', message: 'détail interne' });
    expect(await appleIdentity()).toEqual({ ok: false, code: 'unknown' });
  });
});
