import { describeAccount } from '../model/account';
import { DEMO_CODE, isDemoSession } from '../model/demo-session';
import { useAuthStore } from '../model/store';

/**
 * Les nouveaux parcours quand aucun back-end n'est branché (le cas du client qui teste l'APK) :
 * tout s'enchaîne comme avec un vrai serveur, avec un code de démonstration à la place du SMS.
 * Les tests tournent sans variables Supabase : `demoMode` vaut `true`.
 */
const state = () => useAuthStore.getState();

beforeEach(() => {
  useAuthStore.setState({ session: null, status: 'unauthenticated', error: null });
});

describe('connexion par téléphone', () => {
  it('ouvre une session de démonstration au nom du numéro, normalisé', async () => {
    expect(await state().signIn('06 12 34 56 78', 'motdepasse1')).toEqual({ ok: true });
    expect(state().status).toBe('authenticated');
    expect(describeAccount(state().session)).toMatchObject({
      email: null,
      phone: '+33612345678',
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

  it('refuse un code mal formé avant toute vérification', async () => {
    expect(await state().confirmSignUp('neo@exemple.fr', '12')).toEqual({
      ok: false,
      error: 'invalid_input',
    });
  });

  it('l’inscription de démonstration n’exige aucun code', async () => {
    expect(await state().signUp('neo@exemple.fr', 'motdepasse1')).toEqual({
      ok: true,
      needsCode: false,
    });
  });
});

describe('vérifier son numéro', () => {
  it('rattache le numéro à la session une fois le code de démonstration saisi', async () => {
    await state().signIn('neo@exemple.fr', 'motdepasse1');
    expect(describeAccount(state().session)?.phoneVerified).toBe(false);

    expect(await state().startPhoneVerification('06 12 34 56 78')).toEqual({ ok: true });
    expect(await state().confirmPhone('06 12 34 56 78', '654321')).toEqual({
      ok: false,
      error: 'otp_invalid',
    });
    expect(await state().confirmPhone('06 12 34 56 78', DEMO_CODE)).toEqual({ ok: true });

    expect(describeAccount(state().session)).toMatchObject({
      email: 'neo@exemple.fr',
      phone: '+33612345678',
      phoneVerified: true,
    });
  });

  it('refuse un numéro invalide', async () => {
    expect(await state().startPhoneVerification('12 34')).toEqual({
      ok: false,
      error: 'invalid_input',
    });
  });
});

describe('mot de passe oublié', () => {
  it('code, puis nouveau mot de passe', async () => {
    const requested = await state().requestPasswordReset('neo@exemple.fr');
    expect(requested).toEqual({ ok: true, identifier: { kind: 'email', value: 'neo@exemple.fr' } });
    if (!requested.ok) throw new Error('inattendu');

    expect(await state().verifyResetCode(requested.identifier, '111111')).toEqual({
      ok: false,
      error: 'otp_invalid',
    });
    expect(await state().verifyResetCode(requested.identifier, DEMO_CODE)).toEqual({ ok: true });
    expect(state().status).toBe('authenticated');

    expect(await state().setNewPassword('court')).toEqual({ ok: false, error: 'weak_password' });
    expect(await state().setNewPassword('nouveau-mdp-1')).toEqual({ ok: true });
  });

  it('un identifiant invalide est refusé', async () => {
    expect(await state().requestPasswordReset('???')).toEqual({
      ok: false,
      error: 'invalid_input',
    });
  });
});

describe('Google et Apple', () => {
  it('ouvrent une session de démonstration marquée du fournisseur', async () => {
    const google = await state().signInWithGoogle();
    expect(google).toMatchObject({ ok: true, isNewUser: true, firstName: 'Alex' });
    expect(describeAccount(state().session)?.provider).toBe('google');

    await state().signOut();
    const apple = await state().signInWithApple();
    expect(apple).toMatchObject({ ok: true });
    expect(describeAccount(state().session)?.provider).toBe('apple');
  });
});
