import {
  afterSignUpRoute,
  decideEntry,
  firstRunRoute,
  homeFor,
  type EntryState,
} from '../model/gate';

const base: EntryState = {
  hydrated: true,
  splashDone: true,
  auth: 'authenticated',
  onboardingCompleted: true,
  role: 'consommateur',
  here: '',
};
const at = (here: string, over: Partial<EntryState> = {}) =>
  decideEntry({ ...base, ...over, here });

describe('la porte d’entrée — un compte est obligatoire', () => {
  it('ne décide rien tant que le disque n’est pas relu', () => {
    expect(at('', { hydrated: false, splashDone: false })).toBeNull();
    expect(at('commandes', { hydrated: false })).toBeNull();
  });

  it('joue le logo animé à chaque ouverture, même avant de connaître la session', () => {
    expect(at('', { splashDone: false })).toBe('/welcome');
    expect(at('', { splashDone: false, auth: 'loading' })).toBe('/welcome');
    expect(at('welcome', { splashDone: false })).toBeNull();
  });

  it('attend la session avant toute autre décision', () => {
    expect(at('commandes', { auth: 'loading' })).toBeNull();
    // Le logo a fini mais la session n'est pas relue : il reste affiché.
    expect(at('welcome', { auth: 'loading' })).toBeNull();
  });

  it('après le logo, emmène chacun là où il doit aller', () => {
    expect(at('welcome')).toBe('/');
    expect(at('welcome', { auth: 'unauthenticated', onboardingCompleted: false })).toBe('/role');
    expect(at('welcome', { auth: 'unauthenticated', onboardingCompleted: true })).toBe('/sign-in');
    expect(at('welcome', { onboardingCompleted: false, role: 'grossiste' })).toBe('/dossier-pro');
  });

  describe('sans compte', () => {
    const out = { auth: 'unauthenticated' as const, onboardingCompleted: false };

    it('ouvre seulement le profil, l’inscription, la connexion et le mot de passe oublié', () => {
      for (const here of ['role', 'sign-in', 'sign-up', 'forgot-password']) {
        expect(at(here, out)).toBeNull();
      }
    });

    it('n’ouvre AUCUN écran de l’app : pas de parcours sans compte', () => {
      for (const here of [
        '',
        '(tabs)',
        'commandes',
        'panier',
        'profil',
        'produit',
        'onboarding',
        'dossier-pro',
        'account',
        '+not-found',
      ]) {
        expect(at(here, out)).toBe('/role');
      }
    });

    it('renvoie à la connexion quelqu’un qui avait déjà installé l’app', () => {
      expect(at('commandes', { auth: 'unauthenticated', onboardingCompleted: true })).toBe(
        '/sign-in',
      );
    });
  });

  describe('connecté, accueil local pas encore fait', () => {
    const fresh = { onboardingCompleted: false };

    it('laisse finir l’inscription, la connexion, le mot de passe oublié et l’accueil', () => {
      for (const here of [
        'sign-up',
        'sign-in',
        'forgot-password',
        'onboarding',
        'devenir-livreur',
        'dossier-pro',
      ]) {
        expect(at(here, fresh)).toBeNull();
      }
    });

    it('envoie chaque profil à SA première étape', () => {
      expect(at('', { ...fresh, role: 'consommateur' })).toBe('/onboarding');
      expect(at('', { ...fresh, role: 'commercant' })).toBe('/dossier-pro');
      expect(at('', { ...fresh, role: 'grossiste' })).toBe('/dossier-pro');
      expect(at('commandes', { ...fresh, role: 'livreur' })).toBe('/devenir-livreur');
      expect(at('role', { ...fresh, role: 'livreur' })).toBe('/devenir-livreur');
    });
  });

  describe('connecté et installé', () => {
    it('entre dans l’app', () => {
      for (const here of ['', '(tabs)', 'commandes', 'account', 'forgot-password']) {
        expect(at(here)).toBeNull();
      }
    });

    it('ne revoit plus le choix du profil', () => {
      expect(at('role')).toBe('/');
    });

    it('laisse la connexion et l’inscription finir leur écran (elles naviguent elles-mêmes)', () => {
      expect(at('sign-in')).toBeNull();
      expect(at('sign-up')).toBeNull();
    });
  });
});

describe('après le logo animé', () => {
  it('va là où la porte l’enverrait', () => {
    expect(
      homeFor({ auth: 'unauthenticated', onboardingCompleted: false, role: 'consommateur' }),
    ).toBe('/role');
    expect(
      homeFor({ auth: 'unauthenticated', onboardingCompleted: true, role: 'consommateur' }),
    ).toBe('/sign-in');
    expect(homeFor({ auth: 'authenticated', onboardingCompleted: false, role: 'grossiste' })).toBe(
      '/dossier-pro',
    );
    expect(homeFor({ auth: 'authenticated', onboardingCompleted: true, role: 'livreur' })).toBe(
      '/',
    );
  });

  it('la première étape d’accueil de chaque profil', () => {
    expect(firstRunRoute('consommateur')).toBe('/onboarding');
    expect(firstRunRoute('commercant')).toBe('/dossier-pro');
    expect(firstRunRoute('grossiste')).toBe('/dossier-pro');
    expect(firstRunRoute('livreur')).toBe('/devenir-livreur');
  });

  it('après l’inscription, un compte qui a déjà fait l’accueil entre directement', () => {
    // « Créer un compte » puis Google avec un compte Google déjà inscrit : c'est une reconnexion.
    expect(afterSignUpRoute('consommateur', true)).toBe('/');
    expect(afterSignUpRoute('grossiste', true)).toBe('/');
    expect(afterSignUpRoute('consommateur', false)).toBe('/onboarding');
    expect(afterSignUpRoute('livreur', false)).toBe('/devenir-livreur');
  });
});
