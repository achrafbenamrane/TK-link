import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import { openAuthSessionAsync } from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabase } from '@/shared/lib/supabase';

import * as service from '../model/service';

/**
 * Le service d'authentification, contre un FAUX client Supabase.
 *
 * On ne peut pas joindre un vrai serveur depuis Jest : ces tests prouvent que chaque action envoie
 * à `supabase-js` le bon appel avec les bons paramètres (types d'OTP, corps de la fonction Edge,
 * nonce, redirection d'Apple…) et que chaque réponse du serveur est classée dans la bonne catégorie.
 * Que le serveur, lui, réponde comme prévu se vérifie avec `npm run auth:check` contre le vrai projet.
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
      refreshSession: jest.fn(),
      signInWithIdToken: jest.fn(),
      signInWithOAuth: jest.fn(),
      exchangeCodeForSession: jest.fn(),
      signOut: jest.fn(),
    },
    from: jest.fn(),
    rpc: jest.fn(),
    functions: { invoke: jest.fn() },
  },
}));

/** Apple sur Android passe par un onglet du navigateur du système : simulé, il n'y en a pas ici. */
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }));

type AuthMethod =
  | 'signInWithPassword'
  | 'signUp'
  | 'verifyOtp'
  | 'resend'
  | 'updateUser'
  | 'resetPasswordForEmail'
  | 'refreshSession'
  | 'signInWithIdToken'
  | 'signInWithOAuth'
  | 'exchangeCodeForSession'
  | 'signOut';
const auth = supabase.auth as unknown as Record<AuthMethod, jest.Mock>;
const from = supabase.from as unknown as jest.Mock;
const rpc = supabase.rpc as unknown as jest.Mock;
const invoke = supabase.functions.invoke as unknown as jest.Mock;
const openAuthSession = openAuthSessionAsync as unknown as jest.Mock;

const OK = { data: {}, error: null };

/**
 * Ce que `functions.invoke` REND (il ne lève jamais) quand la requête n'a pas pu partir : une
 * `FunctionsFetchError` — la vraie classe de `@supabase/functions-js` — dont le `context` est la
 * `TypeError` de `fetch`, sans réponse ni corps.
 */
const offline = () => ({
  data: null,
  error: new FunctionsFetchError(new TypeError('Network request failed')),
});

/** Un refus HTTP tel que `functions.invoke` le rend : `FunctionsHttpError`, `context` = la `Response`. */
const httpRefusal = (status: number, body: unknown) => ({
  data: null,
  error: new FunctionsHttpError(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  ),
});
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

  it('dit quand l’e-mail du code n’a pas pu partir (Resend en panne, quota atteint)', async () => {
    auth.signUp.mockResolvedValue(
      authError('unexpected_failure', 'Error sending confirmation email'),
    );
    expect(await service.signUpWithEmail('a@b.fr', 'motdepasse1', meta)).toEqual({
      ok: false,
      code: 'email_unavailable',
    });
    auth.resend.mockResolvedValue(
      authError('unexpected_failure', 'Error sending confirmation email'),
    );
    expect(await service.resendSignUpCode('a@b.fr')).toEqual({
      ok: false,
      code: 'email_unavailable',
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

describe('numéro de téléphone d’un compte connecté (sans code SMS)', () => {
  const PHONE = '+33612345678';

  /**
   * Ce que `functions.invoke` rend quand la fonction Edge refuse : une `FunctionsHttpError` dont le
   * `context` est la `Response`. Le corps `{ "error": "…" }` se lit sur un clone de celle-ci.
   */
  const refusal = (body: unknown) => {
    const response = () => ({ json: jest.fn().mockResolvedValue(body) });
    return {
      data: null,
      error: {
        name: 'FunctionsHttpError',
        message: 'Edge Function returned a non-2xx status code',
        context: { ...response(), clone: jest.fn(response) },
      },
    };
  };

  it('associe le numéro par la fonction Edge `link-phone`, puis rafraîchit la session', async () => {
    expect(await service.linkPhone(PHONE)).toEqual({ ok: true });
    expect(invoke).toHaveBeenCalledWith('link-phone', { method: 'POST', body: { phone: PHONE } });
    expect(auth.refreshSession).toHaveBeenCalledTimes(1);
    // Rafraîchie APRÈS l'association : c'est elle qui fait voir le numéro dans la session.
    const [invoked] = invoke.mock.invocationCallOrder;
    const [refreshed] = auth.refreshSession.mock.invocationCallOrder;
    expect(refreshed).toBeGreaterThan(invoked ?? Infinity);
  });

  it('l’association tient même si le rafraîchissement de la session échoue', async () => {
    auth.refreshSession.mockRejectedValue(new TypeError('Network request failed'));
    expect(await service.linkPhone(PHONE)).toEqual({ ok: true });
    auth.refreshSession.mockResolvedValue(authError('refresh_token_not_found'));
    expect(await service.linkPhone(PHONE)).toEqual({ ok: true });
  });

  it.each([
    ['phone_exists', 'phone_taken'],
    ['phone_locked', 'phone_locked'],
    ['invalid_phone', 'invalid_input'],
    ['email_not_confirmed', 'email_not_confirmed'],
    ['too_many_attempts', 'rate_limited'],
    ['unauthorized', 'session_missing'],
  ])('traduit le refus « %s » de la fonction Edge en « %s »', async (body, code) => {
    invoke.mockResolvedValue(refusal({ error: body }));
    expect(await service.linkPhone(PHONE)).toEqual({ ok: false, code });
    expect(auth.refreshSession).not.toHaveBeenCalled();
  });

  it('lit le refus sur un clone de la réponse, ou sur la réponse elle-même faute de clone', async () => {
    const refused = refusal({ error: 'phone_exists' });
    invoke.mockResolvedValue(refused);
    await service.linkPhone(PHONE);
    expect(refused.error.context.clone).toHaveBeenCalled();
    expect(refused.error.context.json).not.toHaveBeenCalled();

    invoke.mockResolvedValue({
      data: null,
      error: {
        name: 'FunctionsHttpError',
        message: 'Edge Function returned a non-2xx status code',
        context: { json: jest.fn().mockResolvedValue({ error: 'phone_locked' }) },
      },
    });
    expect(await service.linkPhone(PHONE)).toEqual({ ok: false, code: 'phone_locked' });
  });

  it('un refus inconnu ou illisible reste un échec générique, sans le détail du serveur', async () => {
    invoke.mockResolvedValue(refusal({ error: 'server_error', detail: 'secret interne' }));
    const unknownRefusal = await service.linkPhone(PHONE);
    expect(unknownRefusal).toEqual({ ok: false, code: 'unknown' });
    expect(JSON.stringify(unknownRefusal)).not.toContain('secret');

    // Un corps qui n'est pas du JSON (page d'erreur d'un relais, par exemple).
    invoke.mockResolvedValue({
      data: null,
      error: {
        name: 'FunctionsHttpError',
        message: 'Edge Function returned a non-2xx status code',
        context: {
          clone: () => ({ json: () => Promise.reject(new SyntaxError('Unexpected token <')) }),
        },
      },
    });
    expect(await service.linkPhone(PHONE)).toEqual({ ok: false, code: 'unknown' });

    // Un `error` qui n'est pas un texte, puis une erreur sans réponse jointe.
    invoke.mockResolvedValue(refusal({ error: 409 }));
    expect(await service.linkPhone(PHONE)).toEqual({ ok: false, code: 'unknown' });
    invoke.mockResolvedValue({ data: null, error: { name: 'FunctionsHttpError', message: 'x' } });
    expect(await service.linkPhone(PHONE)).toEqual({ ok: false, code: 'unknown' });
    expect(auth.refreshSession).not.toHaveBeenCalled();
  });

  it('hors ligne : la `FunctionsFetchError` RENDUE par `invoke` est classée « réseau »', async () => {
    invoke.mockResolvedValue(offline());
    expect(await service.linkPhone(PHONE)).toEqual({ ok: false, code: 'network' });
    expect(auth.refreshSession).not.toHaveBeenCalled();
  });

  it('jeton refusé par la fonction (`unauthorized`, 401) : il faut se reconnecter', async () => {
    invoke.mockResolvedValue(httpRefusal(401, { error: 'unauthorized' }));
    expect(await service.linkPhone(PHONE)).toEqual({ ok: false, code: 'session_missing' });
    expect(auth.refreshSession).not.toHaveBeenCalled();
  });

  it('jeton refusé par la passerelle, dans son propre format (401 « Invalid JWT ») : se reconnecter', async () => {
    // Sans champ `error` texte : seul le statut 401 dit que la session ne vaut plus rien.
    invoke.mockResolvedValue(httpRefusal(401, { code: 401, message: 'Invalid JWT' }));
    expect(await service.linkPhone(PHONE)).toEqual({ ok: false, code: 'session_missing' });

    // Le même format avec un autre statut n'est PAS une session perdue.
    invoke.mockResolvedValue(httpRefusal(500, { code: 500, message: 'Internal Server Error' }));
    expect(await service.linkPhone(PHONE)).toEqual({ ok: false, code: 'unknown' });
    expect(auth.refreshSession).not.toHaveBeenCalled();
  });

  it('un refus au corps illisible garde la catégorie de son code (repli sur le classement)', async () => {
    // Contrat du repli : ce que le corps ne dit pas, le code de l'erreur le dit encore.
    invoke.mockResolvedValue({
      data: null,
      error: {
        code: 'over_request_rate_limit',
        message: 'x',
        context: new Response('<html>Too Many Requests</html>', { status: 429 }),
      },
    });
    expect(await service.linkPhone(PHONE)).toEqual({ ok: false, code: 'rate_limited' });
  });

  it('une exception levée malgré tout est classée « réseau » ou « inconnue »', async () => {
    invoke.mockRejectedValue(new TypeError('Network request failed'));
    expect(await service.linkPhone(PHONE)).toEqual({ ok: false, code: 'network' });
    invoke.mockRejectedValue(new Error('panne'));
    expect(await service.linkPhone(PHONE)).toEqual({ ok: false, code: 'unknown' });
    expect(auth.refreshSession).not.toHaveBeenCalled();
  });
});

describe('mot de passe oublié (par e-mail seulement)', () => {
  it('envoie un code de récupération à l’adresse, sans autre option', async () => {
    expect(await service.requestPasswordReset('a@b.fr')).toEqual({ ok: true });
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('a@b.fr');
  });

  it('laisse voir une limite d’envoi, un e-mail qui n’a pas pu partir ou une coupure réseau', async () => {
    auth.resetPasswordForEmail.mockResolvedValue(authError('over_email_send_rate_limit'));
    expect(await service.requestPasswordReset('a@b.fr')).toEqual({
      ok: false,
      code: 'rate_limited',
    });
    auth.resetPasswordForEmail.mockResolvedValue(
      authError('unexpected_failure', 'Error sending recovery email'),
    );
    expect(await service.requestPasswordReset('a@b.fr')).toEqual({
      ok: false,
      code: 'email_unavailable',
    });
    auth.resetPasswordForEmail.mockRejectedValue(new TypeError('Network request failed'));
    expect(await service.requestPasswordReset('a@b.fr')).toEqual({
      ok: false,
      code: 'network',
    });
  });

  it('vérifie le code (type « recovery ») : il ouvre la session qui autorise le changement', async () => {
    expect(await service.verifyPasswordReset('a@b.fr', '123456')).toEqual({ ok: true });
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      email: 'a@b.fr',
      token: '123456',
      type: 'recovery',
    });
  });

  it('refuse un code de récupération faux ou expiré', async () => {
    auth.verifyOtp.mockResolvedValue(authError('otp_expired', 'Token has expired or is invalid'));
    expect(await service.verifyPasswordReset('a@b.fr', '000000')).toEqual({
      ok: false,
      code: 'otp_invalid',
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

describe('profil serveur', () => {
  /** `from('profiles').select(…).eq('id', …).maybeSingle()` : chaque maillon reste observable. */
  const profileQuery = (result: { data: unknown; error: unknown }) => {
    const maybeSingle = jest.fn().mockResolvedValue(result);
    const eq = jest.fn().mockReturnValue({ maybeSingle });
    const select = jest.fn().mockReturnValue({ eq });
    from.mockReturnValue({ select });
    return { select, eq, maybeSingle };
  };

  it('relit le profil de la personne connectée et le traduit pour l’app', async () => {
    const query = profileQuery({
      data: {
        first_name: 'Sofia',
        last_name: 'Rey',
        account_type: 'commercant',
        account_type_declared: true,
      },
      error: null,
    });
    expect(await service.fetchMyProfile('u1')).toEqual({
      ok: true,
      profile: {
        firstName: 'Sofia',
        lastName: 'Rey',
        accountType: 'commercant',
        accountTypeDeclared: true,
      },
    });
    expect(from).toHaveBeenCalledWith('profiles');
    expect(query.select).toHaveBeenCalledWith(
      'first_name, last_name, account_type, account_type_declared',
    );
    expect(query.eq).toHaveBeenCalledWith('id', 'u1');
    expect(query.maybeSingle).toHaveBeenCalled();
  });

  it('un nom absent devient vide ; un type pas encore déclaré (Google, Apple) le dit', async () => {
    profileQuery({
      data: {
        first_name: null,
        last_name: null,
        account_type: 'consommateur',
        account_type_declared: false,
      },
      error: null,
    });
    expect(await service.fetchMyProfile('u1')).toEqual({
      ok: true,
      profile: {
        firstName: '',
        lastName: '',
        accountType: 'consommateur',
        accountTypeDeclared: false,
      },
    });
  });

  it('pas de ligne, ou une ligne illisible : aucun profil, l’app garde ce qu’elle a', async () => {
    profileQuery({ data: null, error: null });
    expect(await service.fetchMyProfile('u1')).toEqual({ ok: true, profile: null });

    profileQuery({
      data: {
        first_name: 'Sofia',
        last_name: 'Rey',
        account_type: 'pirate',
        account_type_declared: true,
      },
      error: null,
    });
    expect(await service.fetchMyProfile('u1')).toEqual({ ok: true, profile: null });

    profileQuery({
      data: { first_name: 'Sofia', last_name: 'Rey', account_type: 'commercant' },
      error: null,
    });
    expect(await service.fetchMyProfile('u1')).toEqual({ ok: true, profile: null });
  });

  it('un refus du serveur ou une coupure réseau est un échec classé, sans le détail', async () => {
    profileQuery({
      data: null,
      error: { code: '42501', message: 'permission denied for table profiles' },
    });
    const refused = await service.fetchMyProfile('u1');
    expect(refused).toEqual({ ok: false, code: 'unknown' });
    expect(JSON.stringify(refused)).not.toContain('permission');

    // PostgREST rend la coupure réseau comme une erreur, sans lever.
    profileQuery({ data: null, error: { code: '', message: 'TypeError: Network request failed' } });
    expect(await service.fetchMyProfile('u1')).toEqual({ ok: false, code: 'network' });

    from.mockImplementation(() => {
      throw new TypeError('Network request failed');
    });
    expect(await service.fetchMyProfile('u1')).toEqual({ ok: false, code: 'network' });
  });
});

describe('type de compte d’un compte Google ou Apple', () => {
  it('le déclare côté serveur, par la fonction SQL `declare_account_type`', async () => {
    rpc.mockResolvedValue({ data: 'livreur', error: null });
    expect(await service.declareAccountType('livreur')).toEqual({
      ok: true,
      accountType: 'livreur',
    });
    expect(rpc).toHaveBeenCalledWith('declare_account_type', { p_type: 'livreur' });
  });

  it('rend le type EFFECTIF : une seconde déclaration ne remplace pas la première', async () => {
    rpc.mockResolvedValue({ data: 'commercant', error: null });
    expect(await service.declareAccountType('consommateur')).toEqual({
      ok: true,
      accountType: 'commercant',
    });
  });

  it('une réponse qui n’est pas un type connu est un échec, jamais un type inventé', async () => {
    rpc.mockResolvedValue({ data: 'pirate', error: null });
    expect(await service.declareAccountType('livreur')).toEqual({ ok: false, code: 'unknown' });
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await service.declareAccountType('livreur')).toEqual({ ok: false, code: 'unknown' });
  });

  it('hors ligne, PostgREST REND l’erreur sans lever : classée « réseau »', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        message: 'TypeError: Network request failed',
        details: 'TypeError: Network request failed',
        hint: '',
        code: '',
      },
      count: null,
      status: 0,
      statusText: '',
    });
    expect(await service.declareAccountType('livreur')).toEqual({ ok: false, code: 'network' });
  });

  it('un refus du serveur ou une exception levée est un échec classé', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        code: 'PGRST202',
        message: 'Could not find the function public.declare_account_type(p_type)',
      },
    });
    expect(await service.declareAccountType('livreur')).toEqual({ ok: false, code: 'unknown' });
    rpc.mockRejectedValue(new TypeError('Network request failed'));
    expect(await service.declareAccountType('livreur')).toEqual({ ok: false, code: 'network' });
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

describe('Apple sur Android : la page web d’Apple, avec PKCE', () => {
  const recent = new Date().toISOString();
  const APPLE_PAGE = 'https://projet.supabase.co/auth/v1/authorize?provider=apple&code_challenge=c';

  /** Le lien de retour dans l'app, tel que l'onglet le rend une fois la page d'Apple quittée. */
  const returnsTo = (url: string) => openAuthSession.mockResolvedValue({ type: 'success', url });

  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'android');
    auth.signInWithOAuth.mockResolvedValue({
      data: { provider: 'apple', url: APPLE_PAGE },
      error: null,
    });
    returnsTo('tklink://auth/callback?code=code-pkce');
    auth.exchangeCodeForSession.mockResolvedValue({
      data: {
        user: { id: 'u1', email: 'sofia@privaterelay.appleid.com', created_at: recent },
        session: {},
      },
      error: null,
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it('fait fabriquer la page par Supabase, l’ouvre dans un onglet, puis échange le code', async () => {
    expect(await service.signInWithAppleWeb()).toEqual({
      ok: true,
      isNewUser: true,
      userId: 'u1',
      email: 'sofia@privaterelay.appleid.com',
    });
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'apple',
      options: { redirectTo: 'tklink://auth/callback', skipBrowserRedirect: true },
    });
    expect(openAuthSession).toHaveBeenCalledWith(APPLE_PAGE, 'tklink://auth/callback');
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('code-pkce');
  });

  it('reconnaît un compte ancien ; une adresse absente devient vide', async () => {
    auth.exchangeCodeForSession.mockResolvedValue({
      data: { user: { id: 'u1', created_at: '2026-01-01T00:00:00Z' }, session: {} },
      error: null,
    });
    expect(await service.signInWithAppleWeb()).toEqual({
      ok: true,
      isNewUser: false,
      userId: 'u1',
      email: '',
    });
  });

  it('un onglet fermé (« dismiss ») ou jamais ouvert (« cancel ») est une annulation', async () => {
    openAuthSession.mockResolvedValue({ type: 'dismiss' });
    expect(await service.signInWithAppleWeb()).toEqual({ ok: false, code: 'cancelled' });
    openAuthSession.mockResolvedValue({ type: 'cancel' });
    expect(await service.signInWithAppleWeb()).toEqual({ ok: false, code: 'cancelled' });
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('la page d’Apple fermée par la personne (« user_cancelled_authorize ») est une annulation', async () => {
    returnsTo('tklink://auth/callback?error=user_cancelled_authorize&error_description=annule');
    expect(await service.signInWithAppleWeb()).toEqual({ ok: false, code: 'cancelled' });
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('un refus (« access_denied ») n’est PAS une annulation : il est classé par son code', async () => {
    returnsTo(
      'tklink://auth/callback?error=access_denied&error_code=signup_disabled' +
        '&error_description=Signups+not+allowed+for+this+instance',
    );
    expect(await service.signInWithAppleWeb()).toEqual({ ok: false, code: 'signup_disabled' });

    // Sans code précis : un échec générique, jamais le libellé du serveur.
    returnsTo('tklink://auth/callback?error=access_denied&error_description=Compte+suspendu');
    const denied = await service.signInWithAppleWeb();
    expect(denied).toEqual({ ok: false, code: 'unknown' });
    expect(JSON.stringify(denied)).not.toContain('suspendu');
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('lit aussi l’erreur dans le fragment, où Supabase la recopie', async () => {
    returnsTo(
      'tklink://auth/callback#error=access_denied&error_code=signup_disabled' +
        '&error_description=Signups+not+allowed+for+this+instance',
    );
    expect(await service.signInWithAppleWeb()).toEqual({ ok: false, code: 'signup_disabled' });
    returnsTo('tklink://auth/callback#error=user_cancelled_authorize');
    expect(await service.signInWithAppleWeb()).toEqual({ ok: false, code: 'cancelled' });
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('un onglet déjà ouvert (l’ouverture lève) : échec classé, sans plantage ni échange', async () => {
    openAuthSession.mockRejectedValue(
      new Error('WebBrowser is already open, only one can be open at a time'),
    );
    await expect(service.signInWithAppleWeb()).resolves.toEqual({ ok: false, code: 'unknown' });
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('un retour sans code ni erreur est un échec, sans rien échanger', async () => {
    returnsTo('tklink://auth/callback');
    expect(await service.signInWithAppleWeb()).toEqual({ ok: false, code: 'unknown' });
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('un échange refusé (code expiré) ou coupé par le réseau est un échec classé', async () => {
    auth.exchangeCodeForSession.mockResolvedValue({
      data: { user: null, session: null },
      error: {
        code: 'flow_state_expired',
        message: 'invalid flow state, flow state has expired',
        name: 'AuthApiError',
      },
    });
    const expired = await service.signInWithAppleWeb();
    expect(expired).toEqual({ ok: false, code: 'unknown' });
    expect(JSON.stringify(expired)).not.toContain('flow state');

    auth.exchangeCodeForSession.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Failed to fetch', name: 'AuthRetryableFetchError' },
    });
    expect(await service.signInWithAppleWeb()).toEqual({ ok: false, code: 'network' });
  });

  it('sans adresse de page fabriquée par Supabase, l’onglet ne s’ouvre pas', async () => {
    auth.signInWithOAuth.mockResolvedValue({ data: { provider: 'apple', url: null }, error: null });
    expect(await service.signInWithAppleWeb()).toEqual({ ok: false, code: 'unknown' });
    expect(openAuthSession).not.toHaveBeenCalled();
  });

  it('sur le web : indisponible, sans rien demander à Supabase', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    expect(await service.signInWithAppleWeb()).toEqual({ ok: false, code: 'unavailable' });
    expect(auth.signInWithOAuth).not.toHaveBeenCalled();
    expect(openAuthSession).not.toHaveBeenCalled();
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

  it('hors ligne : la `FunctionsFetchError` RENDUE par `invoke` est classée « réseau »', async () => {
    invoke.mockResolvedValue(offline());
    expect(await service.deleteAccount()).toEqual({ ok: false, code: 'network' });
  });
});
