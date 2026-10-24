import { act, fireEvent, render, screen, waitFor } from '@/shared/testing/render';

import { EMPTY_REGISTRATION, validateRegistration } from '../model/registration';
import { useAuthStore, type AuthResult, type SocialSignIn } from '../model/store';
import { SignUpScreen } from '../ui/sign-up-screen';

/**
 * Google n'est branché dans aucune build de test : on le déclare branché pour que son bouton existe
 * aussi face à un vrai serveur (simulé). En démonstration, Google et Apple s'affichent de toute façon.
 */
jest.mock('@/shared/lib/env', () => ({
  ...jest.requireActual('@/shared/lib/env'),
  isGoogleConfigured: true,
}));

/** La démonstration garde sa session dans le stockage sécurisé : un double en mémoire sous Jest. */
jest.mock('@/shared/lib/storage', () => ({
  ...jest.requireActual('@/shared/lib/storage'),
  secureStorage: {
    get: jest.fn(async () => null),
    set: jest.fn(async () => undefined),
    remove: jest.fn(async () => undefined),
  },
}));

const fill = (testID: string, value: string) =>
  fireEvent.changeText(screen.getByTestId(testID), value);

/** Une promesse que le test résout quand il veut : la route n'a pas fini tant qu'il ne l'a pas fait. */
function deferred() {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((done) => {
    resolve = () => done();
  });
  return { promise, resolve };
}

const stateOf = (testID: string) => screen.getByTestId(testID).props.accessibilityState;

const original = useAuthStore.getState();

beforeEach(() => {
  useAuthStore.setState({
    session: null,
    status: 'unauthenticated',
    error: null,
    demoMode: original.demoMode,
    signUp: original.signUp,
    linkPhone: original.linkPhone,
    signInWithGoogle: original.signInWithGoogle,
    signInWithApple: original.signInWithApple,
  });
});

/** Le formulaire complet d'un particulier, CGU acceptées. */
function consumerForm() {
  fill('signup-firstname', 'Neo');
  fill('signup-lastname', 'Test');
  fill('signup-email', 'neo@exemple.fr');
  fill('signup-phone', '06 12 34 56 78');
  fill('signup-password', 'motdepasse1');
  fill('signup-confirm', 'motdepasse1');
  fireEvent.press(screen.getByTestId('signup-terms'));
}

describe('validateRegistration — le professionnel', () => {
  const base = {
    ...EMPTY_REGISTRATION,
    firstName: 'Neo',
    lastName: 'Test',
    email: 'neo@exemple.fr',
    phone: '06 12 34 56 78',
    password: 'motdepasse1',
    confirm: 'motdepasse1',
  };

  it('exige le nom du commerce, sa catégorie et son adresse', () => {
    const errors = validateRegistration(base, 'commercant');
    expect(errors.shopName).toBeDefined();
    expect(errors.category).toBeDefined();
    expect(errors.address).toBeDefined();
  });

  it('n’exige rien de tout cela d’un consommateur', () => {
    expect(validateRegistration(base, 'consommateur')).toEqual({});
  });

  it('laisse le SIRET facultatif : le CDC ne l’exige qu’au moment de publier ou commander en B2B', () => {
    const pro = {
      ...base,
      shopName: 'O’Tokyo',
      category: 'restauration',
      address: '12 rue des Arts',
    };
    expect(validateRegistration(pro, 'commercant')).toEqual({});
  });

  it('refuse une catégorie qui n’est pas l’une des huit du CDC', () => {
    const pro = {
      ...base,
      shopName: 'O’Tokyo',
      category: 'alimentation',
      address: '12 rue des Arts',
    };
    expect(validateRegistration(pro, 'commercant').category).toBeDefined();
  });
});

describe('<SignUpScreen /> — consommateur', () => {
  it('exige d’accepter les CGU avant de créer le compte', async () => {
    const signUp = jest.fn();
    useAuthStore.setState({ signUp });
    const onSignedUp = jest.fn();
    render(<SignUpScreen role="consommateur" onSignedUp={onSignedUp} />);
    fill('signup-firstname', 'Neo');
    fill('signup-lastname', 'Test');
    fill('signup-email', 'neo@exemple.fr');
    fill('signup-phone', '06 12 34 56 78');
    fill('signup-password', 'motdepasse1');
    fill('signup-confirm', 'motdepasse1');

    fireEvent.press(screen.getByTestId('signup-submit'));
    expect(await screen.findByTestId('signup-terms-error')).toHaveTextContent(
      'Acceptez les CGU et la politique de confidentialité.',
    );
    expect(signUp).not.toHaveBeenCalled();
    expect(onSignedUp).not.toHaveBeenCalled();
  });

  it('ne montre ni commerce, ni catégorie, ni onglets Commerçant / Grossiste', () => {
    render(<SignUpScreen role="consommateur" />);
    expect(screen.queryByTestId('signup-shopname')).toBeNull();
    expect(screen.queryByTestId('signup-role-commercant')).toBeNull();
    expect(screen.queryByTestId('signup-free-ops')).toBeNull();
  });

  it('ne propose plus « Continuer sans compte » : le compte est obligatoire', () => {
    for (const role of ['consommateur', 'grossiste', 'livreur'] as const) {
      const { unmount } = render(<SignUpScreen role={role} />);
      expect(screen.getByTestId('signup-alternatives')).toBeOnTheScreen();
      expect(screen.queryByTestId('signup-skip')).toBeNull();
      expect(screen.queryByLabelText('Continuer sans compte')).toBeNull();
      unmount();
    }
  });

  it('laisse la ville facultative', async () => {
    const onProfile = jest.fn();
    render(<SignUpScreen role="consommateur" onProfile={onProfile} onSignedUp={jest.fn()} />);
    fill('signup-firstname', 'Neo');
    fill('signup-lastname', 'Test');
    fill('signup-email', 'neo@exemple.fr');
    fill('signup-phone', '06 12 34 56 78');
    fill('signup-password', 'motdepasse1');
    fill('signup-confirm', 'motdepasse1');
    fireEvent.press(screen.getByTestId('signup-terms'));
    fireEvent.press(screen.getByTestId('signup-submit'));

    await waitFor(() => expect(onProfile).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('signup-location-error')).toBeNull();
  });

  it('ne range le profil qu’une fois le compte créé : un refus du serveur ne laisse rien derrière lui', async () => {
    const signUp = jest.fn().mockImplementation(async () => {
      useAuthStore.setState({ error: 'user_exists' });
      return { ok: false, error: 'user_exists' };
    });
    useAuthStore.setState({ signUp });
    const onProfile = jest.fn();
    const onSignedUp = jest.fn();
    render(<SignUpScreen role="consommateur" onProfile={onProfile} onSignedUp={onSignedUp} />);
    consumerForm();
    fireEvent.press(screen.getByTestId('signup-submit'));

    expect(await screen.findByTestId('signup-error')).toHaveTextContent(
      'Un compte existe déjà avec cet identifiant. Connectez-vous.',
    );
    expect(signUp).toHaveBeenCalledTimes(1);
    expect(onProfile).not.toHaveBeenCalled();
    expect(onSignedUp).not.toHaveBeenCalled();
    expect(stateOf('signup-submit')).toMatchObject({ busy: false, disabled: false });
  });

  it('garde « Créer mon compte » occupé jusqu’à ce que la route ait fini, puis le libère', async () => {
    const route = deferred();
    const onSignedUp = jest.fn(() => route.promise);
    const onProfile = jest.fn();
    render(<SignUpScreen role="consommateur" onProfile={onProfile} onSignedUp={onSignedUp} />);
    consumerForm();
    fireEvent.press(screen.getByTestId('signup-submit'));

    await waitFor(() => expect(onSignedUp).toHaveBeenCalledTimes(1));
    // Le compte existe : le profil est rangé, et la route travaille encore (type de compte, accueil).
    expect(onProfile).toHaveBeenCalledTimes(1);
    expect(stateOf('signup-submit')).toMatchObject({ busy: true, disabled: true });
    expect(stateOf('auth-google')).toMatchObject({ disabled: true });

    route.resolve();
    await waitFor(() =>
      expect(stateOf('signup-submit')).toMatchObject({ busy: false, disabled: false }),
    );
    expect(onSignedUp).toHaveBeenCalledTimes(1);
  });
});

/** Les coordonnées et le mot de passe d'un professionnel — tout est sur la même page. */
function proStepOne() {
  fill('signup-firstname', 'Neo');
  fill('signup-lastname', 'Test');
  fill('signup-email', 'pro@exemple.fr');
  fill('signup-phone', '06 12 34 56 78');
  fill('signup-password', 'motdepasse1');
  fill('signup-confirm', 'motdepasse1');
}

/** La fiche de l'entreprise et le numéro de contact — ce que Google et Apple ne donnent pas. */
function proCompany() {
  fill('signup-phone', '06 12 34 56 78');
  fill('signup-shopname', 'Grossiste Occitan');
  fireEvent.press(screen.getByTestId('signup-category-open'));
  fireEvent.press(screen.getByTestId('signup-category-restauration'));
  fill('signup-address', '14 avenue des Pyrénées, Muret');
}

describe('<SignUpScreen /> — commerçant et grossiste', () => {
  it('ne propose plus de bascule de rôle : le profil est choisi avant, et les 5 opérations gratuites sont celles du commerçant', () => {
    const { unmount } = render(<SignUpScreen role="commercant" />);
    expect(screen.queryByTestId('signup-role-grossiste')).toBeNull();
    expect(screen.getAllByText('Créer mon compte commerçant').length).toBeGreaterThan(0);
    // « 5 » vient du paramètre administrable, pas d'une constante du code (CDC §6.2).
    expect(screen.getByTestId('signup-free-ops')).toHaveTextContent(/5 opérations Flash/);
    unmount();

    render(<SignUpScreen role="grossiste" />);
    expect(screen.getAllByText('Créer mon compte grossiste').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('signup-free-ops')).toBeNull();
  });

  it('propose Touch & Collect et Livraison — « Sur place » n’existe pas dans le CDC', () => {
    render(<SignUpScreen role="commercant" />);
    proStepOne();
    expect(screen.getByTestId('signup-mode-touch-collect')).toBeTruthy();
    expect(screen.getByTestId('signup-mode-livraison')).toBeTruthy();
    expect(screen.queryByText('Sur place')).toBeNull();
  });

  it('transmet la fiche du commerce à la route', async () => {
    const onProfile = jest.fn();
    render(<SignUpScreen role="commercant" onProfile={onProfile} onSignedUp={jest.fn()} />);
    proStepOne();
    fill('signup-shopname', 'O’Tokyo');
    fireEvent.press(screen.getByTestId('signup-category-open'));
    fireEvent.press(screen.getByTestId('signup-category-restauration'));
    fill('signup-address', '12 rue des Arts, Toulouse');
    fireEvent.press(screen.getByTestId('signup-mode-livraison'));
    fireEvent.press(screen.getByTestId('signup-terms'));
    fireEvent.press(screen.getByTestId('signup-submit'));

    await waitFor(() => expect(onProfile).toHaveBeenCalledTimes(1));
    expect(onProfile.mock.calls[0]![0]).toMatchObject({
      shopName: 'O’Tokyo',
      category: 'restauration',
      address: '12 rue des Arts, Toulouse',
      modes: ['touch-collect', 'livraison'],
    });
  });

  it('exige au moins un mode de remise', async () => {
    const signUp = jest.fn();
    useAuthStore.setState({ signUp });
    render(<SignUpScreen role="commercant" />);
    // Tout le reste est valide : seul le mode de remise manque, et lui seul bloque.
    proStepOne();
    proCompany();
    fireEvent.press(screen.getByTestId('signup-mode-touch-collect')); // décoche le défaut
    fireEvent.press(screen.getByTestId('signup-terms'));
    fireEvent.press(screen.getByTestId('signup-submit'));

    expect(await screen.findByTestId('signup-modes-error')).toHaveTextContent(
      'Choisissez au moins un mode de remise.',
    );
    expect(screen.queryByTestId('signup-shopname-error')).toBeNull();
    expect(signUp).not.toHaveBeenCalled();
  });
});

describe('<SignUpScreen /> — avec Google ou Apple', () => {
  it('un grossiste remplit la fiche de son entreprise et son numéro, sinon rien ne part', async () => {
    const signInWithGoogle = jest.fn();
    const signInWithApple = jest.fn();
    useAuthStore.setState({ signInWithGoogle, signInWithApple });
    render(<SignUpScreen role="grossiste" onSignedUp={jest.fn()} />);
    fireEvent.press(screen.getByTestId('signup-terms'));
    fireEvent.press(screen.getByTestId('auth-google'));

    expect(await screen.findByTestId('signup-shopname-error')).toHaveTextContent(
      'Indiquez le nom de votre commerce.',
    );
    expect(screen.getByTestId('signup-category-error')).toHaveTextContent(
      'Choisissez une catégorie.',
    );
    expect(screen.getByTestId('signup-address-error')).toHaveTextContent(
      'Indiquez l’adresse de votre commerce.',
    );
    expect(screen.getByTestId('signup-phone-error')).toHaveTextContent(
      'Numéro invalide (ex. 06 12 34 56 78).',
    );
    // Le fournisseur donne l'identité : ni nom, ni e-mail, ni mot de passe. Le SIRET reste facultatif.
    for (const id of ['firstname', 'lastname', 'email', 'password', 'confirm', 'siret']) {
      expect(screen.queryByTestId(`signup-${id}-error`)).toBeNull();
    }
    expect(screen.queryByTestId('signup-terms-error')).toBeNull();

    fireEvent.press(screen.getByTestId('auth-apple'));
    expect(signInWithGoogle).not.toHaveBeenCalled();
    expect(signInWithApple).not.toHaveBeenCalled();
  });

  it('un SIRET mal saisi ou aucun mode de remise bloquent aussi un grossiste', async () => {
    const signInWithGoogle = jest.fn();
    useAuthStore.setState({ signInWithGoogle });
    render(<SignUpScreen role="grossiste" onSignedUp={jest.fn()} />);
    proCompany();
    fill('signup-siret', '123');
    fireEvent.press(screen.getByTestId('signup-mode-touch-collect')); // décoche le défaut
    fireEvent.press(screen.getByTestId('signup-terms'));
    fireEvent.press(screen.getByTestId('auth-google'));

    expect(await screen.findByTestId('signup-siret-error')).toHaveTextContent(
      'Ce SIRET est invalide (14 chiffres).',
    );
    expect(screen.getByTestId('signup-modes-error')).toHaveTextContent(
      'Choisissez au moins un mode de remise.',
    );
    expect(screen.queryByTestId('signup-shopname-error')).toBeNull();
    expect(signInWithGoogle).not.toHaveBeenCalled();
  });

  it('un particulier n’a rien d’autre à remplir, mais un numéro tapé doit être valide', async () => {
    const signInWithGoogle = jest.fn();
    useAuthStore.setState({ signInWithGoogle });
    render(<SignUpScreen role="consommateur" onSignedUp={jest.fn()} />);
    fireEvent.press(screen.getByTestId('signup-terms'));
    fill('signup-phone', '06 12');
    fireEvent.press(screen.getByTestId('auth-google'));

    expect(await screen.findByTestId('signup-phone-error')).toHaveTextContent(
      'Numéro invalide (ex. 06 12 34 56 78).',
    );
    expect(screen.queryByTestId('signup-email-error')).toBeNull();
    expect(screen.queryByTestId('signup-password-error')).toBeNull();
    expect(signInWithGoogle).not.toHaveBeenCalled();
  });

  it('grossiste, fiche remplie : le nom du fournisseur l’emporte, celui du formulaire comble les trous, puis la route', async () => {
    useAuthStore.setState({
      signInWithGoogle: jest.fn().mockResolvedValue({
        ok: true,
        isNewUser: true,
        firstName: 'Sofia',
        lastName: '',
        email: 'sofia@exemple.fr',
      }),
    });
    const onProfile = jest.fn();
    const onSignedUp = jest.fn();
    render(<SignUpScreen role="grossiste" onProfile={onProfile} onSignedUp={onSignedUp} />);
    fill('signup-firstname', 'Neo');
    fill('signup-lastname', 'Test');
    proCompany();
    fireEvent.press(screen.getByTestId('signup-terms'));
    fireEvent.press(screen.getByTestId('auth-google'));

    await waitFor(() => expect(onSignedUp).toHaveBeenCalledTimes(1));
    expect(onProfile).toHaveBeenCalledWith({
      firstName: 'Sofia',
      lastName: 'Test',
      email: 'sofia@exemple.fr',
      phone: '06 12 34 56 78',
      siret: '',
      location: '',
      shopName: 'Grossiste Occitan',
      category: 'restauration',
      address: '14 avenue des Pyrénées, Muret',
      modes: ['touch-collect'],
    });
    expect(onProfile.mock.invocationCallOrder[0]!).toBeLessThan(
      onSignedUp.mock.invocationCallOrder[0]!,
    );
  });

  it('le bouton tourne jusqu’à ce que la route ait fini', async () => {
    useAuthStore.setState({
      signInWithGoogle: jest.fn().mockResolvedValue({
        ok: true,
        isNewUser: true,
        firstName: 'Sofia',
        lastName: 'Rey',
        email: 'sofia@exemple.fr',
      }),
    });
    const route = deferred();
    const onSignedUp = jest.fn(() => route.promise);
    render(<SignUpScreen role="consommateur" onSignedUp={onSignedUp} />);
    fireEvent.press(screen.getByTestId('signup-terms'));
    fireEvent.press(screen.getByTestId('auth-google'));

    await waitFor(() => expect(onSignedUp).toHaveBeenCalledTimes(1));
    expect(stateOf('auth-google')).toMatchObject({ busy: true, disabled: true });
    expect(stateOf('auth-apple')).toMatchObject({ disabled: true });

    route.resolve();
    await waitFor(() =>
      expect(stateOf('auth-google')).toMatchObject({ busy: false, disabled: false }),
    );
  });

  it('vrai serveur : le numéro tapé s’associe au compte avant d’entrer, comme par e-mail', async () => {
    const linkPhone = jest.fn().mockResolvedValue({ ok: true });
    useAuthStore.setState({
      demoMode: false,
      linkPhone,
      signInWithGoogle: jest.fn().mockResolvedValue({
        ok: true,
        isNewUser: true,
        firstName: 'Sofia',
        lastName: 'Rey',
        email: 'sofia@exemple.fr',
      }),
    });
    const onProfile = jest.fn();
    const onSignedUp = jest.fn();
    render(<SignUpScreen role="consommateur" onProfile={onProfile} onSignedUp={onSignedUp} />);
    fill('signup-phone', '06 12 34 56 78');
    fireEvent.press(screen.getByTestId('signup-terms'));
    fireEvent.press(screen.getByTestId('auth-google'));

    await waitFor(() => expect(onSignedUp).toHaveBeenCalledTimes(1));
    expect(linkPhone).toHaveBeenCalledWith('+33612345678');
    expect(onProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: 'Sofia',
        lastName: 'Rey',
        email: 'sofia@exemple.fr',
        phone: '06 12 34 56 78',
      }),
    );
    expect(screen.getByTestId('sign-up-verification')).toBeOnTheScreen();
  });
});

/** Une connexion Google que le test termine quand il veut : la fenêtre reste ouverte jusque-là. */
function pendingGoogle() {
  type Result = AuthResult<SocialSignIn>;
  let finish: (result: Result) => void = () => {};
  const signInWithGoogle = jest.fn(() => new Promise<Result>((resolve) => (finish = resolve)));
  return { signInWithGoogle, finish: (result: Result) => finish(result) };
}

describe('<SignUpScreen /> — une seule création de compte à la fois', () => {
  it('pendant que Google est ouvert, « Créer mon compte » est bloqué et ne lance aucune inscription', async () => {
    const google = pendingGoogle();
    const signUp = jest.fn().mockResolvedValue({ ok: true, needsCode: false });
    useAuthStore.setState({ signInWithGoogle: google.signInWithGoogle, signUp });
    render(<SignUpScreen role="consommateur" onSignedUp={jest.fn()} />);
    consumerForm();
    fireEvent.press(screen.getByTestId('auth-google'));

    await waitFor(() =>
      expect(stateOf('auth-google')).toMatchObject({ busy: true, disabled: true }),
    );
    expect(stateOf('signup-submit')).toMatchObject({ busy: false, disabled: true });
    fireEvent.press(screen.getByTestId('signup-submit'));
    expect(signUp).not.toHaveBeenCalled();

    google.finish({ ok: false, error: 'cancelled' });
    await waitFor(() => expect(stateOf('signup-submit')).toMatchObject({ disabled: false }));
    expect(signUp).not.toHaveBeenCalled();
  });

  it('Google puis « Créer mon compte » dans la même image : une seule création part, celle de Google', async () => {
    const google = pendingGoogle();
    const signUp = jest.fn().mockResolvedValue({ ok: true, needsCode: false });
    useAuthStore.setState({ signInWithGoogle: google.signInWithGoogle, signUp });
    render(<SignUpScreen role="consommateur" onSignedUp={jest.fn()} />);
    consumerForm();

    // Les deux appuis avant le prochain rendu : le bouton n'a pas encore eu le temps de se griser.
    act(() => {
      fireEvent.press(screen.getByTestId('auth-google'));
      fireEvent.press(screen.getByTestId('signup-submit'));
    });

    expect(google.signInWithGoogle).toHaveBeenCalledTimes(1);
    expect(signUp).not.toHaveBeenCalled();

    google.finish({ ok: false, error: 'cancelled' });
    await waitFor(() => expect(stateOf('auth-google')).toMatchObject({ disabled: false }));
  });

  it('deux appuis rapides sur Google n’ouvrent qu’une seule fenêtre', async () => {
    const google = pendingGoogle();
    useAuthStore.setState({ signInWithGoogle: google.signInWithGoogle });
    render(<SignUpScreen role="consommateur" onSignedUp={jest.fn()} />);
    fireEvent.press(screen.getByTestId('signup-terms'));

    act(() => {
      fireEvent.press(screen.getByTestId('auth-google'));
      fireEvent.press(screen.getByTestId('auth-google'));
    });
    expect(google.signInWithGoogle).toHaveBeenCalledTimes(1);

    // Et, une fois le bouton grisé, un appui de plus ne relance rien non plus.
    await waitFor(() => expect(stateOf('auth-google')).toMatchObject({ disabled: true }));
    fireEvent.press(screen.getByTestId('auth-google'));
    expect(google.signInWithGoogle).toHaveBeenCalledTimes(1);

    google.finish({ ok: false, error: 'cancelled' });
    await waitFor(() => expect(stateOf('auth-google')).toMatchObject({ disabled: false }));
  });

  it('après un échec de Google, le formulaire crée le compte normalement', async () => {
    const signInWithGoogle = jest.fn().mockImplementation(async () => {
      useAuthStore.setState({ error: 'provider_disabled' });
      return { ok: false, error: 'provider_disabled' };
    });
    const signUp = jest.fn().mockImplementation(async () => {
      useAuthStore.setState({ error: null });
      return { ok: true, needsCode: false };
    });
    useAuthStore.setState({ signInWithGoogle, signUp });
    const onSignedUp = jest.fn();
    render(<SignUpScreen role="consommateur" onSignedUp={onSignedUp} />);
    consumerForm();
    fireEvent.press(screen.getByTestId('auth-google'));

    expect(await screen.findByTestId('signup-error')).toHaveTextContent(
      'Cette méthode de connexion n’est pas disponible pour le moment.',
    );
    await waitFor(() =>
      expect(stateOf('signup-submit')).toMatchObject({ busy: false, disabled: false }),
    );
    expect(stateOf('auth-google')).toMatchObject({ busy: false, disabled: false });
    expect(onSignedUp).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('signup-submit'));
    await waitFor(() => expect(onSignedUp).toHaveBeenCalledTimes(1));
    expect(signUp).toHaveBeenCalledTimes(1);
    expect(signUp).toHaveBeenCalledWith(
      'neo@exemple.fr',
      'motdepasse1',
      expect.objectContaining({ phone: '+33612345678', accountType: 'consommateur' }),
    );
    expect(signInWithGoogle).toHaveBeenCalledTimes(1);
  });
});

describe('<SignUpScreen /> — une seule page', () => {
  it('un professionnel a TOUS ses champs sur la même page, sans étape', () => {
    render(<SignUpScreen role="commercant" />);
    for (const id of [
      'firstname',
      'lastname',
      'email',
      'phone',
      'shopname',
      'siret',
      'address',
      'location',
      'password',
      'confirm',
    ]) {
      expect(screen.getByTestId(`signup-${id}`)).toBeTruthy();
    }
    expect(screen.getByTestId('signup-category-open')).toBeTruthy();
    expect(screen.queryByTestId('signup-next')).toBeNull();
  });

  it('la catégorie est une liste déroulante', () => {
    render(<SignUpScreen role="commercant" />);
    expect(screen.queryByTestId('signup-category-list')).toBeNull();
    fireEvent.press(screen.getByTestId('signup-category-open'));
    expect(screen.getByTestId('signup-category-list')).toBeTruthy();
    fireEvent.press(screen.getByTestId('signup-category-mode'));
    expect(screen.queryByTestId('signup-category-list')).toBeNull();
  });

  it('un consommateur a tous ses champs sur la même page, sans étape', () => {
    render(<SignUpScreen role="consommateur" />);
    for (const id of [
      'firstname',
      'lastname',
      'email',
      'phone',
      'password',
      'confirm',
      'location',
    ]) {
      expect(screen.getByTestId(`signup-${id}`)).toBeTruthy();
    }
    expect(screen.queryByTestId('signup-next')).toBeNull();
  });
});

describe('<SignUpScreen /> — le grossiste parle de retrait et d’expédition', () => {
  it('ne propose pas « Touch & Collect », mot du commerce', () => {
    render(<SignUpScreen role="grossiste" />);
    expect(screen.getByLabelText('Retrait')).toBeTruthy();
    expect(screen.getByLabelText('Expédition')).toBeTruthy();
    expect(screen.queryByLabelText('Touch & Collect')).toBeNull();
  });

  it('garde « Touch & Collect » et « Livraison » pour le commerçant', () => {
    render(<SignUpScreen role="commercant" />);
    expect(screen.getByLabelText('Touch & Collect')).toBeTruthy();
    expect(screen.getByLabelText('Livraison')).toBeTruthy();
  });
});
