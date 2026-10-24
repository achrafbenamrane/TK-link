import { supabase } from '@/shared/lib/supabase';

import * as service from '../model/service';

/**
 * Le service d'authentification, contre un FAUX client Supabase.
 *
 * On ne peut pas joindre un vrai serveur depuis Jest : ces tests prouvent que chaque action envoie
 * à `supabase-js` le bon appel avec les bons paramètres (types d'OTP, `shouldCreateUser`, nonce…) et
 * que chaque réponse du serveur est classée dans la bonne catégorie. Que le serveur, lui, réponde
 * comme prévu se vérifie avec `npm run auth:check` contre le vrai projet.
 */
jest.mock('@/shared/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      verifyOtp: jest.fn(),
      resend: jest.fn(),
      updateUser: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      signInWithOtp: jest.fn(),
      signInWithIdToken: jest.fn(),
      signOut: jest.fn(),
    },
    from: jest.fn(),
    functions: { invoke: jest.fn() },
  },
}));

type AuthMethod =
  | 'signInWithPassword'
  | 'signUp'
  | 'verifyOtp'
  | 'resend'
  | 'updateUser'
  | 'resetPasswordForEmail'
  | 'signInWithOtp'
  | 'signInWithIdToken'
  | 'signOut';
const auth = supabase.auth as unknown as Record<AuthMethod, jest.Mock>;
const from = supabase.from as unknown as jest.Mock;
const invoke = supabase.functions.invoke as unknown as jest.Mock;

const OK = { data: {}, error: null };
const authError = (code: string, message = 'x', name = 'AuthApiError') => ({
  data: {},
  error: { code, message, name },
});

beforeEach(() => {
  jest.resetAllMocks();
  for (const fn of Object.values(auth)) fn.mockResolvedValue(OK);
  invoke.mockResolvedValue({ data: null, error: null });
});

describe('connexion par mot de passe', () => {
  it('envoie l’e-mail tel quel', async () => {
    const result = await service.signInWithPassword(
      { kind: 'email', value: 'neo@exemple.fr' },
      'motdepasse1',
    );
    expect(result).toEqual({ ok: true });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'neo@exemple.fr',
      password: 'motdepasse1',
    });
  });

  it('envoie un numéro de téléphone en E.164, sans champ e-mail', async () => {
    await service.signInWithPassword({ kind: 'phone', value: '+33612345678' }, 'motdepasse1');
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      phone: '+33612345678',
      password: 'motdepasse1',
    });
  });

  it('classe un mauvais mot de passe sans dire si l’identifiant existe', async () => {
    auth.signInWithPassword.mockResolvedValue(
      authError('invalid_credentials', 'Invalid login credentials'),
    );
    expect(
      await service.signInWithPassword({ kind: 'email', value: 'a@b.fr' }, 'faux-faux-1'),
    ).toEqual({
      ok: false,
      code: 'invalid_credentials',
    });
  });

  it('distingue un compte non confirmé', async () => {
    auth.signInWithPassword.mockResolvedValue(authError('email_not_confirmed'));
    expect(
      await service.signInWithPassword({ kind: 'email', value: 'a@b.fr' }, 'motdepasse1'),
    ).toEqual({
      ok: false,
      code: 'email_not_confirmed',
    });
    auth.signInWithPassword.mockResolvedValue(authError('phone_not_confirmed'));
    expect(
      await service.signInWithPassword({ kind: 'phone', value: '+33612345678' }, 'motdepasse1'),
    ).toEqual({ ok: false, code: 'phone_not_confirmed' });
  });

  it('transforme une exception réseau en échec classé, sans la laisser remonter', async () => {
    auth.signInWithPassword.mockRejectedValue(new TypeError('Network request failed'));
    expect(
      await service.signInWithPassword({ kind: 'email', value: 'a@b.fr' }, 'motdepasse1'),
    ).toEqual({
      ok: false,
      code: 'network',
    });
  });
});

describe('inscription par e-mail', () => {
  const meta = {
    firstName: 'Neo',
    lastName: 'Démo',
    phone: '+33612345678',
    accountType: 'commercant' as const,
  };

  it('envoie le prénom, le nom, le contact et le type de compte comme métadonnées', async () => {
    auth.signUp.mockResolvedValue({
      data: { session: null, user: { identities: [{}] } },
      error: null,
    });
    await service.signUpWithEmail('neo@exemple.fr', 'motdepasse1', meta);
    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'neo@exemple.fr',
      password: 'motdepasse1',
      options: {
        data: {
          account_type: 'commercant',
          first_name: 'Neo',
          last_name: 'Démo',
          contact_phone: '+33612345678',
        },
      },
    });
  });

  it('n’envoie pas les champs vides', async () => {
    auth.signUp.mockResolvedValue({
      data: { session: {}, user: { identities: [{}] } },
      error: null,
    });
    await service.signUpWithEmail('neo@exemple.fr', 'motdepasse1', {
      firstName: '',
      lastName: '',
      phone: '',
      accountType: 'consommateur',
    });
    expect(auth.signUp.mock.calls[0]?.[0].options.data).toEqual({ account_type: 'consommateur' });
  });

  it('demande un code quand le serveur exige la confirmation (pas de session)', async () => {
    auth.signUp.mockResolvedValue({
      data: { session: null, user: { identities: [{}] } },
      error: null,
    });
    expect(await service.signUpWithEmail('a@b.fr', 'motdepasse1', meta)).toEqual({
      ok: true,
      needsCode: true,
    });
  });

  it('ouvre directement la session quand le serveur n’exige pas de confirmation', async () => {
    auth.signUp.mockResolvedValue({
      data: { session: { access_token: 'x' }, user: { identities: [{}] } },
      error: null,
    });
    expect(await service.signUpWithEmail('a@b.fr', 'motdepasse1', meta)).toEqual({
      ok: true,
      needsCode: false,
    });
  });

  it('dit qu’un compte existe quand Supabase renvoie un utilisateur « fantôme » sans identité', async () => {
    auth.signUp.mockResolvedValue({
      data: { session: null, user: { identities: [] } },
      error: null,
    });
    expect(await service.signUpWithEmail('a@b.fr', 'motdepasse1', meta)).toEqual({
      ok: false,
      code: 'user_exists',
    });
  });

  it('classe les refus du serveur', async () => {
    auth.signUp.mockResolvedValue(authError('weak_password'));
    expect(await service.signUpWithEmail('a@b.fr', 'motdepasse1')).toEqual({
      ok: false,
      code: 'weak_password',
    });
    auth.signUp.mockResolvedValue(authError('signup_disabled'));
    expect(await service.signUpWithEmail('a@b.fr', 'motdepasse1')).toEqual({
      ok: false,
      code: 'signup_disabled',
    });
    auth.signUp.mockResolvedValue(authError('user_already_exists'));
    expect(await service.signUpWithEmail('a@b.fr', 'motdepasse1')).toEqual({
      ok: false,
      code: 'user_exists',
    });
  });

  it('confirme avec le code (type « signup ») et sait le renvoyer', async () => {
    expect(await service.confirmSignUp('a@b.fr', '123456')).toEqual({ ok: true });
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      email: 'a@b.fr',
      token: '123456',
      type: 'signup',
    });

    await service.resendSignUpCode('a@b.fr');
    expect(auth.resend).toHaveBeenCalledWith({ type: 'signup', email: 'a@b.fr' });
  });

  it('un code faux ou expiré est une seule et même catégorie', async () => {
    auth.verifyOtp.mockResolvedValue(authError('otp_expired', 'Token has expired or is invalid'));
    expect(await service.confirmSignUp('a@b.fr', '000000')).toEqual({
      ok: false,
      code: 'otp_invalid',
    });
  });
});

describe('numéro de téléphone d’un compte connecté', () => {
  it('rattache le numéro, le confirme (type « phone_change ») et renvoie le code', async () => {
    expect(await service.startPhoneVerification('+33612345678')).toEqual({ ok: true });
    expect(auth.updateUser).toHaveBeenCalledWith({ phone: '+33612345678' });

    await service.confirmPhone('+33612345678', '123456');
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      phone: '+33612345678',
      token: '123456',
      type: 'phone_change',
    });

    await service.resendPhoneCode('+33612345678');
    expect(auth.resend).toHaveBeenCalledWith({ type: 'phone_change', phone: '+33612345678' });
  });

  it('dit quand aucun fournisseur de SMS n’est branché', async () => {
    auth.updateUser.mockResolvedValue(
      authError('sms_send_failed', 'Error sending confirmation OTP to provider'),
    );
    expect(await service.startPhoneVerification('+33612345678')).toEqual({
      ok: false,
      code: 'sms_unavailable',
    });
  });

  it('dit quand le numéro est déjà celui d’un autre compte', async () => {
    auth.updateUser.mockResolvedValue(authError('phone_exists'));
    expect(await service.startPhoneVerification('+33612345678')).toEqual({
      ok: false,
      code: 'user_exists',
    });
  });

  it('respecte la limite d’envoi de SMS', async () => {
    auth.updateUser.mockResolvedValue(authError('over_sms_send_rate_limit'));
    expect(await service.startPhoneVerification('+33612345678')).toEqual({
      ok: false,
      code: 'rate_limited',
    });
  });
});

describe('mot de passe oublié', () => {
  it('par e-mail : un lien-code de récupération', async () => {
    expect(await service.requestPasswordReset({ kind: 'email', value: 'a@b.fr' })).toEqual({
      ok: true,
    });
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('a@b.fr');
  });

  it('par téléphone : un code SMS, SANS créer de compte', async () => {
    expect(await service.requestPasswordReset({ kind: 'phone', value: '+33612345678' })).toEqual({
      ok: true,
    });
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      phone: '+33612345678',
      options: { shouldCreateUser: false },
    });
  });

  it('ne révèle pas qu’un numéro n’a pas de compte', async () => {
    auth.signInWithOtp.mockResolvedValue(authError('otp_disabled', 'Signups not allowed for otp'));
    expect(await service.requestPasswordReset({ kind: 'phone', value: '+33600000000' })).toEqual({
      ok: true,
    });
    auth.signInWithOtp.mockResolvedValue(authError('unknown', 'User not found'));
    expect(await service.requestPasswordReset({ kind: 'phone', value: '+33600000000' })).toEqual({
      ok: true,
    });
  });

  it('mais laisse voir une limite d’envoi ou une coupure réseau', async () => {
    auth.signInWithOtp.mockResolvedValue(authError('over_sms_send_rate_limit'));
    expect(await service.requestPasswordReset({ kind: 'phone', value: '+33612345678' })).toEqual({
      ok: false,
      code: 'rate_limited',
    });
    auth.resetPasswordForEmail.mockResolvedValue(authError('over_email_send_rate_limit'));
    expect(await service.requestPasswordReset({ kind: 'email', value: 'a@b.fr' })).toEqual({
      ok: false,
      code: 'rate_limited',
    });
  });

  it('vérifie le code : « recovery » pour un e-mail, « sms » pour un numéro', async () => {
    await service.verifyPasswordReset({ kind: 'email', value: 'a@b.fr' }, '123456');
    expect(auth.verifyOtp).toHaveBeenLastCalledWith({
      email: 'a@b.fr',
      token: '123456',
      type: 'recovery',
    });

    await service.verifyPasswordReset({ kind: 'phone', value: '+33612345678' }, '123456');
    expect(auth.verifyOtp).toHaveBeenLastCalledWith({
      phone: '+33612345678',
      token: '123456',
      type: 'sms',
    });
  });

  it('change le mot de passe de la session ouverte par le code', async () => {
    expect(await service.setPassword('nouveau-mdp-1')).toEqual({ ok: true });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'nouveau-mdp-1' });
  });

  it('refuse un nouveau mot de passe identique à l’ancien', async () => {
    auth.updateUser.mockResolvedValue(authError('same_password'));
    expect(await service.setPassword('identique-1')).toEqual({ ok: false, code: 'same_password' });
  });
});

describe('Google et Apple', () => {
  const recent = new Date().toISOString();

  it('remet le jeton à Supabase, avec le nonce brut pour Apple', async () => {
    auth.signInWithIdToken.mockResolvedValue({
      data: { user: { id: 'u1', created_at: recent } },
      error: null,
    });
    const result = await service.signInWithIdToken('apple', {
      idToken: 'jeton',
      nonce: 'nonce-brut',
    });
    expect(result).toEqual({ ok: true, isNewUser: true, userId: 'u1' });
    expect(auth.signInWithIdToken).toHaveBeenCalledWith({
      provider: 'apple',
      token: 'jeton',
      nonce: 'nonce-brut',
    });
  });

  it('n’envoie pas de nonce quand il n’y en a pas (Google)', async () => {
    auth.signInWithIdToken.mockResolvedValue({
      data: { user: { id: 'u1', created_at: recent } },
      error: null,
    });
    await service.signInWithIdToken('google', { idToken: 'jeton' });
    expect(auth.signInWithIdToken).toHaveBeenCalledWith({ provider: 'google', token: 'jeton' });
  });

  it('reconnaît un compte ancien : ce n’est pas une inscription', async () => {
    auth.signInWithIdToken.mockResolvedValue({
      data: { user: { id: 'u1', created_at: '2026-01-01T00:00:00Z' } },
      error: null,
    });
    expect(await service.signInWithIdToken('google', { idToken: 'jeton' })).toMatchObject({
      ok: true,
      isNewUser: false,
    });
  });

  it('classe un fournisseur désactivé dans Supabase', async () => {
    auth.signInWithIdToken.mockResolvedValue(authError('provider_disabled'));
    expect(await service.signInWithIdToken('google', { idToken: 'jeton' })).toEqual({
      ok: false,
      code: 'provider_disabled',
    });
  });

  it('un jeton rejeté (mauvais destinataire, nonce) n’est jamais montré tel quel', async () => {
    auth.signInWithIdToken.mockResolvedValue(
      authError(
        'validation_failed',
        'Unacceptable audience in id_token: [123.apps.googleusercontent.com]',
      ),
    );
    const result = await service.signInWithIdToken('google', { idToken: 'jeton' });
    expect(result).toEqual({ ok: false, code: 'unknown' });
    expect(JSON.stringify(result)).not.toContain('googleusercontent');
  });

  it('range le nom donné par Apple dans le profil', async () => {
    const eq = jest.fn().mockResolvedValue({ error: null });
    const update = jest.fn().mockReturnValue({ eq });
    from.mockReturnValue({ update });
    await service.rememberName('u1', { firstName: 'Sofia', lastName: 'Rey' });
    expect(from).toHaveBeenCalledWith('profiles');
    expect(update).toHaveBeenCalledWith({
      first_name: 'Sofia',
      last_name: 'Rey',
      display_name: 'Sofia Rey',
    });
    expect(eq).toHaveBeenCalledWith('id', 'u1');
  });

  it('ne touche pas au profil quand Apple n’a donné aucun nom', async () => {
    await service.rememberName('u1', { firstName: ' ', lastName: '' });
    expect(from).not.toHaveBeenCalled();
  });

  it('un échec d’enregistrement du nom n’empêche pas la connexion', async () => {
    from.mockImplementation(() => {
      throw new Error('hors ligne');
    });
    await expect(
      service.rememberName('u1', { firstName: 'Sofia', lastName: '' }),
    ).resolves.toBeUndefined();
  });
});

describe('session', () => {
  it('ne ferme que la session de cet appareil', async () => {
    await service.signOut();
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('supprime le compte par la fonction Edge', async () => {
    expect(await service.deleteAccount()).toEqual({ ok: true });
    expect(invoke).toHaveBeenCalledWith('delete-account', { method: 'POST' });
  });

  it('rend l’échec de suppression, sans le détail du serveur', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: { message: 'secret interne', name: 'FunctionsHttpError' },
    });
    const result = await service.deleteAccount();
    expect(result).toEqual({ ok: false, code: 'unknown' });
    expect(JSON.stringify(result)).not.toContain('secret');
  });
});
