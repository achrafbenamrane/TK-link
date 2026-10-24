import { fireEvent, render, screen, waitFor } from '@/shared/testing/render';

import { useAuthStore } from '../model/store';
import { SignInScreen } from '../ui/sign-in-screen';

const fill = (testID: string, value: string) =>
  fireEvent.changeText(screen.getByTestId(testID), value);

const original = useAuthStore.getState();

beforeEach(() => {
  useAuthStore.setState({
    error: null,
    signIn: original.signIn,
    signInWithGoogle: original.signInWithGoogle,
    signInWithApple: original.signInWithApple,
  });
});

describe('<SignInScreen />', () => {
  it('affiche le formulaire et ne propose les raccourcis que si la route les branche', () => {
    render(<SignInScreen />);
    expect(screen.getByTestId('sign-in-screen')).toBeOnTheScreen();
    expect(screen.getByTestId('auth-identifier')).toBeOnTheScreen();
    expect(screen.getByTestId('auth-password')).toBeOnTheScreen();
    expect(screen.getByTestId('auth-submit')).toBeOnTheScreen();
    expect(screen.queryByTestId('auth-toggle')).toBeNull();
    expect(screen.queryByTestId('auth-merchant')).toBeNull();
    expect(screen.queryByTestId('auth-forgot')).toBeNull();
  });

  it('un seul champ pour l’e-mail OU le téléphone', () => {
    render(<SignInScreen />);
    expect(screen.getByText('E-mail ou téléphone')).toBeOnTheScreen();
    expect(screen.getByLabelText('E-mail ou numéro de téléphone')).toBeOnTheScreen();
  });

  it('signale l’identifiant et le mot de passe invalides sous leur champ, sans appeler le store', async () => {
    const signIn = jest.fn();
    useAuthStore.setState({ signIn });
    render(<SignInScreen />);

    fill('auth-identifier', 'pas-un-email');
    fill('auth-password', 'court');
    fireEvent.press(screen.getByTestId('auth-submit'));

    expect(await screen.findByTestId('auth-identifier-error')).toHaveTextContent(
      'Entrez une adresse e-mail valide.',
    );
    expect(screen.getByTestId('auth-password-error')).toHaveTextContent(/au moins 8 caractères/);
    expect(signIn).not.toHaveBeenCalled();

    // Corriger un champ efface son erreur, pas celle de l’autre.
    fill('auth-identifier', 'neo@exemple.fr');
    expect(screen.queryByTestId('auth-identifier-error')).toBeNull();
    expect(screen.getByTestId('auth-password-error')).toBeOnTheScreen();
  });

  it('dit ce qui cloche dans un numéro mal formé', async () => {
    render(<SignInScreen />);
    fill('auth-identifier', '06 12 34');
    fill('auth-password', 'motdepasse1');
    fireEvent.press(screen.getByTestId('auth-submit'));
    expect(await screen.findByTestId('auth-identifier-error')).toHaveTextContent(/Numéro invalide/);
  });

  it('demande un identifiant quand le champ est vide', async () => {
    render(<SignInScreen />);
    fill('auth-password', 'motdepasse1');
    fireEvent.press(screen.getByTestId('auth-submit'));
    expect(await screen.findByTestId('auth-identifier-error')).toHaveTextContent(
      /e-mail ou votre numéro/,
    );
  });

  it('envoie l’e-mail nettoyé et le mot de passe au store, puis prévient la route', async () => {
    const signIn = jest.fn().mockResolvedValue({ ok: true });
    useAuthStore.setState({ signIn });
    const onSignedIn = jest.fn();
    render(<SignInScreen onSignedIn={onSignedIn} />);

    fill('auth-identifier', '  Neo@Exemple.fr ');
    fill('auth-password', 'motdepasse1');
    fireEvent.press(screen.getByTestId('auth-submit'));

    await waitFor(() => expect(onSignedIn).toHaveBeenCalledTimes(1));
    expect(signIn).toHaveBeenCalledWith('neo@exemple.fr', 'motdepasse1');
    expect(screen.queryByTestId('auth-error')).toBeNull();
  });

  it('envoie un numéro de téléphone au format international', async () => {
    const signIn = jest.fn().mockResolvedValue({ ok: true });
    useAuthStore.setState({ signIn });
    render(<SignInScreen onSignedIn={jest.fn()} />);

    fill('auth-identifier', '06 12 34 56 78');
    fill('auth-password', 'motdepasse1');
    fireEvent.press(screen.getByTestId('auth-submit'));

    await waitFor(() => expect(signIn).toHaveBeenCalledWith('+33612345678', 'motdepasse1'));
  });

  it('affiche l’erreur du serveur en français et ne quitte pas l’écran', async () => {
    const signIn = jest.fn().mockImplementation(async () => {
      useAuthStore.setState({ error: 'invalid_credentials' });
      return { ok: false, error: 'invalid_credentials' };
    });
    useAuthStore.setState({ signIn });
    const onSignedIn = jest.fn();
    render(<SignInScreen onSignedIn={onSignedIn} />);

    fill('auth-identifier', 'neo@exemple.fr');
    fill('auth-password', 'motdepasse1');
    fireEvent.press(screen.getByTestId('auth-submit'));

    expect(await screen.findByTestId('auth-error')).toHaveTextContent(
      'Identifiant ou mot de passe incorrect.',
    );
    expect(onSignedIn).not.toHaveBeenCalled();
  });

  it('n’affiche pas l’erreur d’une session précédente à l’ouverture', () => {
    useAuthStore.setState({ error: 'invalid_credentials' });
    render(<SignInScreen />);
    expect(screen.queryByTestId('auth-error')).toBeNull();
  });

  it('affiche et masque le mot de passe', () => {
    render(<SignInScreen />);
    expect(screen.getByTestId('auth-password').props.secureTextEntry).toBe(true);
    fireEvent.press(screen.getByTestId('auth-eye'));
    expect(screen.getByTestId('auth-password').props.secureTextEntry).toBe(false);
  });

  it('renvoie vers l’inscription consommateur, l’inscription commerçant et le mot de passe oublié', () => {
    const onCreateAccount = jest.fn();
    const onMerchantSignUp = jest.fn();
    const onForgotPassword = jest.fn();
    render(
      <SignInScreen
        onCreateAccount={onCreateAccount}
        onMerchantSignUp={onMerchantSignUp}
        onForgotPassword={onForgotPassword}
      />,
    );

    fireEvent.press(screen.getByTestId('auth-toggle'));
    fireEvent.press(screen.getByTestId('auth-merchant'));
    fireEvent.press(screen.getByTestId('auth-forgot'));

    expect(onCreateAccount).toHaveBeenCalledTimes(1);
    expect(onMerchantSignUp).toHaveBeenCalledTimes(1);
    expect(onForgotPassword).toHaveBeenCalledTimes(1);
  });
});

describe('<SignInScreen /> — Google et Apple', () => {
  it('propose les deux, avec la mention des CGU (aucune case à cocher ici)', () => {
    render(<SignInScreen />);
    expect(screen.getByTestId('auth-google')).toBeOnTheScreen();
    expect(screen.getByTestId('auth-apple')).toBeOnTheScreen();
    expect(screen.getByLabelText('Continuer avec Google')).toBeOnTheScreen();
    expect(screen.getByLabelText('Continuer avec Apple')).toBeOnTheScreen();
    expect(screen.getByTestId('auth-social-legal')).toHaveTextContent(/CGU/);
  });

  it('Google : ouvre la session, range le prénom dans le profil, prévient la route', async () => {
    const signInWithGoogle = jest
      .fn()
      .mockResolvedValue({ ok: true, isNewUser: true, firstName: 'Sofia', lastName: 'Rey' });
    useAuthStore.setState({ signInWithGoogle });
    const onSignedIn = jest.fn();
    const onProfile = jest.fn();
    render(<SignInScreen onSignedIn={onSignedIn} onProfile={onProfile} />);

    fireEvent.press(screen.getByTestId('auth-google'));

    await waitFor(() => expect(onSignedIn).toHaveBeenCalledTimes(1));
    expect(onProfile).toHaveBeenCalledWith({ firstName: 'Sofia', lastName: 'Rey' });
  });

  it('Apple sans nom (connexions suivantes) : pas de profil à ranger, mais la session s’ouvre', async () => {
    const signInWithApple = jest
      .fn()
      .mockResolvedValue({ ok: true, isNewUser: false, firstName: '', lastName: '' });
    useAuthStore.setState({ signInWithApple });
    const onSignedIn = jest.fn();
    const onProfile = jest.fn();
    render(<SignInScreen onSignedIn={onSignedIn} onProfile={onProfile} />);

    fireEvent.press(screen.getByTestId('auth-apple'));

    await waitFor(() => expect(onSignedIn).toHaveBeenCalledTimes(1));
    expect(onProfile).not.toHaveBeenCalled();
  });

  it('fenêtre fermée : ni erreur ni changement d’écran', async () => {
    const signInWithGoogle = jest.fn().mockImplementation(async () => {
      useAuthStore.setState({ error: null });
      return { ok: false, error: 'cancelled' };
    });
    useAuthStore.setState({ signInWithGoogle });
    const onSignedIn = jest.fn();
    render(<SignInScreen onSignedIn={onSignedIn} />);

    fireEvent.press(screen.getByTestId('auth-google'));
    await waitFor(() => expect(signInWithGoogle).toHaveBeenCalledTimes(1));

    expect(screen.queryByTestId('auth-error')).toBeNull();
    expect(onSignedIn).not.toHaveBeenCalled();
  });

  it('un échec s’affiche en français, sans détail du fournisseur', async () => {
    const signInWithGoogle = jest.fn().mockImplementation(async () => {
      useAuthStore.setState({ error: 'provider_disabled' });
      return { ok: false, error: 'provider_disabled' };
    });
    useAuthStore.setState({ signInWithGoogle });
    render(<SignInScreen />);

    fireEvent.press(screen.getByTestId('auth-google'));
    expect(await screen.findByTestId('auth-error')).toHaveTextContent(
      'Cette méthode de connexion n’est pas disponible pour le moment.',
    );
  });

  it('un seul parcours à la fois : le second bouton est bloqué pendant l’attente', async () => {
    let finish: (value: unknown) => void = () => {};
    const signInWithGoogle = jest
      .fn()
      .mockReturnValue(new Promise((resolve) => (finish = resolve)));
    useAuthStore.setState({ signInWithGoogle });
    render(<SignInScreen />);

    fireEvent.press(screen.getByTestId('auth-google'));
    await waitFor(() =>
      expect(screen.getByTestId('auth-apple').props.accessibilityState).toMatchObject({
        disabled: true,
      }),
    );

    finish({ ok: false, error: 'cancelled' });
    await waitFor(() =>
      expect(screen.getByTestId('auth-apple').props.accessibilityState).toMatchObject({
        disabled: false,
      }),
    );
  });
});
