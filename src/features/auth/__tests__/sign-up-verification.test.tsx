import { fireEvent, render, screen, waitFor } from '@/shared/testing/render';

import { useAuthStore } from '../model/store';
import { SignUpScreen } from '../ui/sign-up-screen';

/**
 * Ce qui suit l'inscription quand un VRAI serveur est branché : le code reçu par e-mail, puis la
 * proposition de vérifier le numéro par SMS. Le store est simulé action par action ; on vérifie
 * l'enchaînement des écrans et ce que chaque étape envoie, pas Supabase.
 */
const fill = (testID: string, value: string) =>
  fireEvent.changeText(screen.getByTestId(testID), value);

const fillValidForm = () => {
  fill('signup-firstname', 'Neo');
  fill('signup-lastname', 'Démo');
  fill('signup-email', 'Neo@Exemple.fr');
  fill('signup-phone', '06 12 34 56 78');
  fill('signup-password', 'motdepasse1');
  fill('signup-confirm', 'motdepasse1');
  fireEvent.press(screen.getByTestId('signup-terms'));
};

const original = useAuthStore.getState();
const ok = { ok: true } as const;

beforeEach(() => {
  // Un vrai serveur est branché (le test tourne sans variables Supabase, donc on bascule à la main).
  useAuthStore.setState({
    demoMode: false,
    error: null,
    signUp: jest.fn().mockResolvedValue({ ok: true, needsCode: false }),
    confirmSignUp: jest.fn().mockResolvedValue(ok),
    resendSignUpCode: jest.fn().mockResolvedValue(ok),
    startPhoneVerification: jest.fn().mockResolvedValue(ok),
    confirmPhone: jest.fn().mockResolvedValue(ok),
    resendPhoneCode: jest.fn().mockResolvedValue(ok),
    signInWithGoogle: original.signInWithGoogle,
    signInWithApple: original.signInWithApple,
  });
});

afterAll(() => useAuthStore.setState({ demoMode: original.demoMode }));

describe('inscription → e-mail à confirmer', () => {
  beforeEach(() => {
    useAuthStore.setState({ signUp: jest.fn().mockResolvedValue({ ok: true, needsCode: true }) });
  });

  it('envoie le profil avec le compte : prénom, nom, numéro en E.164, type de compte', async () => {
    render(<SignUpScreen role="commercant" onSignedUp={jest.fn()} />);
    // Un commerçant remplit aussi sa fiche.
    fillValidForm();
    fill('signup-shopname', 'Le Comptoir');
    fireEvent.press(screen.getByTestId('signup-category-open'));
    fireEvent.press(screen.getByTestId('signup-category-restauration'));
    fill('signup-address', '12 rue des Arts');
    fireEvent.press(screen.getByTestId('signup-submit'));

    await screen.findByTestId('verify-email-step');
    expect(useAuthStore.getState().signUp).toHaveBeenCalledWith('neo@exemple.fr', 'motdepasse1', {
      firstName: 'Neo',
      lastName: 'Démo',
      phone: '+33612345678',
      accountType: 'commercant',
    });
  });

  it('montre la saisie du code, avec l’adresse MASQUÉE, à la place du formulaire', async () => {
    render(<SignUpScreen role="consommateur" onSignedUp={jest.fn()} />);
    fillValidForm();
    fireEvent.press(screen.getByTestId('signup-submit'));

    expect(await screen.findByTestId('verify-email-step')).toHaveTextContent(/n•••@exemple.fr/);
    expect(screen.queryByTestId('sign-up-screen')).toBeNull();
    expect(screen.queryByText(/neo@exemple\.fr/)).toBeNull();
  });

  it('un code faux affiche l’erreur et vide le champ ; on peut réessayer', async () => {
    useAuthStore.setState({
      confirmSignUp: jest
        .fn()
        .mockImplementationOnce(async () => ({ ok: false, error: 'otp_invalid' }))
        .mockResolvedValueOnce(ok),
    });
    render(<SignUpScreen role="consommateur" onSignedUp={jest.fn()} />);
    fillValidForm();
    fireEvent.press(screen.getByTestId('signup-submit'));
    await screen.findByTestId('verify-email-step');

    fill('verify-email-input', '000000');
    expect(await screen.findByTestId('verify-email-error')).toHaveTextContent(
      /code incorrect ou expiré/i,
    );
    expect(screen.getByTestId('verify-email-input').props.value).toBe('');

    // Saisir à nouveau efface l'erreur.
    fill('verify-email-input', '123');
    expect(screen.queryByTestId('verify-email-error')).toBeNull();
  });

  it('le sixième chiffre envoie le code tout seul, une seule fois', async () => {
    const confirmSignUp = jest.fn().mockResolvedValue(ok);
    useAuthStore.setState({ confirmSignUp });
    render(<SignUpScreen role="consommateur" onSignedUp={jest.fn()} />);
    fillValidForm();
    fireEvent.press(screen.getByTestId('signup-submit'));
    await screen.findByTestId('verify-email-step');

    // Cinq chiffres : rien ne part. Le bouton reste inactif.
    fill('verify-email-input', '12345');
    expect(confirmSignUp).not.toHaveBeenCalled();
    expect(screen.getByTestId('verify-email-submit').props.accessibilityState).toMatchObject({
      disabled: true,
    });

    // Le sixième : le code part tout seul, et un appui sur le bouton ensuite ne le renvoie pas.
    fill('verify-email-input', '123456');
    fireEvent.press(screen.getByTestId('verify-email-submit'));
    await waitFor(() => expect(confirmSignUp).toHaveBeenCalledTimes(1));
  });

  it('code valide : poursuit vers la proposition de vérifier le numéro', async () => {
    const confirmSignUp = jest.fn().mockResolvedValue(ok);
    useAuthStore.setState({ confirmSignUp });
    render(<SignUpScreen role="consommateur" onSignedUp={jest.fn()} />);
    fillValidForm();
    fireEvent.press(screen.getByTestId('signup-submit'));
    await screen.findByTestId('verify-email-step');

    fill('verify-email-input', '123456');
    await waitFor(() => expect(confirmSignUp).toHaveBeenCalledTimes(1));
    expect(confirmSignUp).toHaveBeenCalledWith('neo@exemple.fr', '123456');
    expect(await screen.findByTestId('verify-phone-offer')).toBeOnTheScreen();
  });

  it('« Modifier mon adresse e-mail » ramène au formulaire', async () => {
    render(<SignUpScreen role="consommateur" onSignedUp={jest.fn()} />);
    fillValidForm();
    fireEvent.press(screen.getByTestId('signup-submit'));
    await screen.findByTestId('verify-email-step');

    fireEvent.press(screen.getByTestId('verify-email-back'));
    expect(await screen.findByTestId('sign-up-screen')).toBeOnTheScreen();
  });

  it('renvoyer le code est bloqué pendant le délai du serveur', async () => {
    render(<SignUpScreen role="consommateur" onSignedUp={jest.fn()} />);
    fillValidForm();
    fireEvent.press(screen.getByTestId('signup-submit'));
    await screen.findByTestId('verify-email-step');

    expect(screen.getByTestId('verify-email-resend').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    expect(screen.getByTestId('verify-email-resend')).toHaveTextContent(/dans \d+ s/);
  });
});

describe('inscription → numéro à vérifier', () => {
  it('session ouverte d’emblée : propose de vérifier le numéro, sans l’imposer', async () => {
    const onSignedUp = jest.fn();
    render(<SignUpScreen role="consommateur" onSignedUp={onSignedUp} />);
    fillValidForm();
    fireEvent.press(screen.getByTestId('signup-submit'));

    expect(await screen.findByTestId('verify-phone-offer')).toHaveTextContent(/[+]33 ••• •• •• 78/);
    expect(onSignedUp).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('verify-phone-later'));
    expect(onSignedUp).toHaveBeenCalledTimes(1);
  });

  it('envoie le code par SMS, le confirme, puis laisse entrer', async () => {
    const onSignedUp = jest.fn();
    render(<SignUpScreen role="consommateur" onSignedUp={onSignedUp} />);
    fillValidForm();
    fireEvent.press(screen.getByTestId('signup-submit'));
    await screen.findByTestId('verify-phone-offer');

    fireEvent.press(screen.getByTestId('verify-phone-send'));
    await screen.findByTestId('verify-phone-step');
    expect(useAuthStore.getState().startPhoneVerification).toHaveBeenCalledWith('+33612345678');

    fill('verify-phone-input', '654321');
    await waitFor(() => expect(onSignedUp).toHaveBeenCalledTimes(1));
    expect(useAuthStore.getState().confirmPhone).toHaveBeenCalledWith('+33612345678', '654321');
  });

  it('un fournisseur de SMS absent ne bloque jamais : message clair, « Plus tard » reste là', async () => {
    useAuthStore.setState({
      startPhoneVerification: jest.fn().mockResolvedValue({ ok: false, error: 'sms_unavailable' }),
    });
    const onSignedUp = jest.fn();
    render(<SignUpScreen role="consommateur" onSignedUp={onSignedUp} />);
    fillValidForm();
    fireEvent.press(screen.getByTestId('signup-submit'));
    await screen.findByTestId('verify-phone-offer');

    fireEvent.press(screen.getByTestId('verify-phone-send'));
    expect(await screen.findByTestId('verify-phone-error')).toHaveTextContent(
      /SMS n’est pas disponible/,
    );

    fireEvent.press(screen.getByTestId('verify-phone-later'));
    expect(onSignedUp).toHaveBeenCalledTimes(1);
  });
});

describe('inscription en démonstration', () => {
  it('n’impose ni code ni vérification de numéro : on entre directement', async () => {
    useAuthStore.setState({ demoMode: true });
    const onSignedUp = jest.fn();
    render(<SignUpScreen role="consommateur" onSignedUp={onSignedUp} />);
    fillValidForm();
    fireEvent.press(screen.getByTestId('signup-submit'));
    await waitFor(() => expect(onSignedUp).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('verify-phone-offer')).toBeNull();
  });
});

describe('inscription avec Google ou Apple', () => {
  it('exige d’accepter les CGU, comme pour le formulaire', async () => {
    const signInWithGoogle = jest.fn();
    useAuthStore.setState({ demoMode: true, signInWithGoogle });
    render(<SignUpScreen role="consommateur" onSignedUp={jest.fn()} />);

    // Le mode de la démonstration affiche les deux ; les tests tournent sur iOS.
    fireEvent.press(screen.getByTestId('auth-google'));
    expect(await screen.findByTestId('signup-terms-error')).toBeTruthy();
    expect(signInWithGoogle).not.toHaveBeenCalled();
  });

  it('une fois les CGU acceptées : ouvre la session et range le prénom', async () => {
    useAuthStore.setState({
      demoMode: true,
      signInWithGoogle: jest
        .fn()
        .mockResolvedValue({ ok: true, isNewUser: true, firstName: 'Sofia', lastName: 'Rey' }),
    });
    const onProfile = jest.fn();
    const onSignedUp = jest.fn();
    render(<SignUpScreen role="consommateur" onProfile={onProfile} onSignedUp={onSignedUp} />);

    fireEvent.press(screen.getByTestId('signup-terms'));
    fireEvent.press(screen.getByTestId('auth-google'));

    await waitFor(() => expect(onSignedUp).toHaveBeenCalledTimes(1));
    expect(onProfile).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: 'Sofia', lastName: 'Rey', category: '' }),
    );
  });

  it('Apple sans nom, formulaire vierge : rien à ranger, mais l’inscription aboutit', async () => {
    useAuthStore.setState({
      demoMode: true,
      signInWithApple: jest
        .fn()
        .mockResolvedValue({ ok: true, isNewUser: true, firstName: '', lastName: '' }),
    });
    const onProfile = jest.fn();
    const onSignedUp = jest.fn();
    render(<SignUpScreen role="consommateur" onProfile={onProfile} onSignedUp={onSignedUp} />);

    fireEvent.press(screen.getByTestId('signup-terms'));
    fireEvent.press(screen.getByTestId('auth-apple'));

    await waitFor(() => expect(onSignedUp).toHaveBeenCalledTimes(1));
    expect(onProfile).not.toHaveBeenCalled();
  });

  it('fenêtre fermée : on reste sur le formulaire', async () => {
    const signInWithGoogle = jest.fn().mockResolvedValue({ ok: false, error: 'cancelled' });
    useAuthStore.setState({ demoMode: true, signInWithGoogle });
    const onSignedUp = jest.fn();
    render(<SignUpScreen role="consommateur" onSignedUp={onSignedUp} />);

    fireEvent.press(screen.getByTestId('signup-terms'));
    fireEvent.press(screen.getByTestId('auth-google'));
    await waitFor(() => expect(signInWithGoogle).toHaveBeenCalledTimes(1));
    expect(onSignedUp).not.toHaveBeenCalled();
    expect(screen.getByTestId('sign-up-screen')).toBeOnTheScreen();
  });

  it('un commerçant n’a pas Google ni Apple : sa fiche professionnelle exige un e-mail pro', () => {
    render(<SignUpScreen role="commercant" />);
    expect(screen.queryByTestId('auth-google')).toBeNull();
    expect(screen.queryByTestId('auth-apple')).toBeNull();
  });
});
