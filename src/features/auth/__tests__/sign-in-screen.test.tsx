import { useState } from 'react';

import { act, fireEvent, render, screen, waitFor } from '@/shared/testing/render';

import { useAuthStore } from '../model/store';
import { SignInScreen } from '../ui/sign-in-screen';

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
    error: null,
    signIn: original.signIn,
    signInWithGoogle: original.signInWithGoogle,
    signInWithApple: original.signInWithApple,
  });
});

describe('<SignInScreen />', () => {
  it('affiche le formulaire et ne propose les raccourcis que si la route les branche', async () => {
    render(<SignInScreen />);
    expect(screen.getByTestId('sign-in-screen')).toBeOnTheScreen();
    expect(screen.getByTestId('auth-identifier')).toBeOnTheScreen();
    expect(screen.getByTestId('auth-password')).toBeOnTheScreen();
    expect(screen.getByTestId('auth-submit')).toBeOnTheScreen();
    expect(screen.queryByTestId('auth-toggle')).toBeNull();
    expect(screen.queryByTestId('auth-merchant')).toBeNull();
    expect(screen.queryByTestId('auth-forgot')).toBeNull();
    // Les icônes chargent leur police après le rendu : on laisse finir ce chargement sous `act`.
    await act(async () => {});
  });

  it('un seul champ pour l’e-mail OU le téléphone', () => {
    render(<SignInScreen />);
    // Pas d'étiquette au-dessus du champ (comme à l'inscription) : le texte indicatif le dit.
    expect(screen.getByPlaceholderText('E-mail ou téléphone')).toBeOnTheScreen();
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
    const signIn = jest.fn();
    useAuthStore.setState({ signIn });
    render(<SignInScreen />);
    fill('auth-identifier', '06 12 34');
    fill('auth-password', 'motdepasse1');
    fireEvent.press(screen.getByTestId('auth-submit'));
    expect(await screen.findByTestId('auth-identifier-error')).toHaveTextContent(
      'Numéro invalide (ex. 06 12 34 56 78 ou +213 5 55 12 34 56).',
    );
    expect(screen.queryByTestId('auth-password-error')).toBeNull();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('demande un identifiant quand le champ est vide', async () => {
    const signIn = jest.fn();
    useAuthStore.setState({ signIn });
    render(<SignInScreen />);
    fill('auth-password', 'motdepasse1');
    fireEvent.press(screen.getByTestId('auth-submit'));
    expect(await screen.findByTestId('auth-identifier-error')).toHaveTextContent(
      'Entrez votre e-mail ou votre numéro de téléphone.',
    );
    expect(signIn).not.toHaveBeenCalled();
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

  it('garde le bouton occupé tant que la route n’a pas fini d’entrer dans l’app, puis le libère', async () => {
    const signIn = jest.fn().mockResolvedValue({ ok: true });
    useAuthStore.setState({ signIn });
    const route = deferred();
    const onSignedIn = jest.fn(() => route.promise);
    render(<SignInScreen onSignedIn={onSignedIn} />);

    fill('auth-identifier', 'neo@exemple.fr');
    fill('auth-password', 'motdepasse1');
    fireEvent.press(screen.getByTestId('auth-submit'));

    await waitFor(() => expect(onSignedIn).toHaveBeenCalledTimes(1));
    // La session est ouverte, la route relit le profil : l'écran attend avec elle.
    expect(stateOf('auth-submit')).toMatchObject({ busy: true, disabled: true });
    // Un second appui pendant l'attente ne relance rien.
    fireEvent.press(screen.getByTestId('auth-submit'));
    expect(signIn).toHaveBeenCalledTimes(1);

    route.resolve();
    await waitFor(() =>
      expect(stateOf('auth-submit')).toMatchObject({ busy: false, disabled: false }),
    );
    expect(onSignedIn).toHaveBeenCalledTimes(1);
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
    const signInWithGoogle = jest.fn().mockResolvedValue({
      ok: true,
      isNewUser: true,
      firstName: 'Sofia',
      lastName: 'Rey',
      email: 'sofia@exemple.fr',
    });
    useAuthStore.setState({ signInWithGoogle });
    const onSignedIn = jest.fn();
    const onProfile = jest.fn();
    render(<SignInScreen onSignedIn={onSignedIn} onProfile={onProfile} />);

    fireEvent.press(screen.getByTestId('auth-google'));

    await waitFor(() => expect(onSignedIn).toHaveBeenCalledTimes(1));
    expect(signInWithGoogle).toHaveBeenCalledTimes(1);
    expect(onProfile).toHaveBeenCalledWith({ firstName: 'Sofia', lastName: 'Rey' });
    expect(onProfile.mock.invocationCallOrder[0]!).toBeLessThan(
      onSignedIn.mock.invocationCallOrder[0]!,
    );
  });

  it('Apple sans nom (connexions suivantes) : pas de profil à ranger, mais la session s’ouvre', async () => {
    const signInWithApple = jest.fn().mockResolvedValue({
      ok: true,
      isNewUser: false,
      firstName: '',
      lastName: '',
      email: 'relais@privaterelay.appleid.com',
    });
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
    await waitFor(() =>
      expect(stateOf('auth-google')).toMatchObject({ busy: false, disabled: false }),
    );
    expect(screen.getByTestId('sign-in-screen')).toBeOnTheScreen();
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
    const signInWithApple = jest.fn();
    const signIn = jest.fn();
    useAuthStore.setState({ signInWithGoogle, signInWithApple, signIn });
    render(<SignInScreen />);
    fill('auth-identifier', 'neo@exemple.fr');
    fill('auth-password', 'motdepasse1');

    fireEvent.press(screen.getByTestId('auth-google'));
    await waitFor(() =>
      expect(screen.getByTestId('auth-apple').props.accessibilityState).toMatchObject({
        disabled: true,
      }),
    );
    expect(stateOf('auth-submit')).toMatchObject({ disabled: true });
    // Appuyer ailleurs pendant que Google est ouvert ne lance rien d'autre.
    fireEvent.press(screen.getByTestId('auth-apple'));
    fireEvent.press(screen.getByTestId('auth-google'));
    fireEvent.press(screen.getByTestId('auth-submit'));
    expect(signInWithApple).not.toHaveBeenCalled();
    expect(signInWithGoogle).toHaveBeenCalledTimes(1);
    expect(signIn).not.toHaveBeenCalled();

    finish({ ok: false, error: 'cancelled' });
    await waitFor(() =>
      expect(screen.getByTestId('auth-apple').props.accessibilityState).toMatchObject({
        disabled: false,
      }),
    );
  });

  it('pendant la connexion par e-mail, Google et Apple ne lancent rien', async () => {
    let finish: (value: unknown) => void = () => {};
    const signIn = jest.fn().mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const signInWithGoogle = jest.fn();
    const signInWithApple = jest.fn();
    useAuthStore.setState({ signIn, signInWithGoogle, signInWithApple });
    render(<SignInScreen onSignedIn={jest.fn()} />);
    fill('auth-identifier', 'neo@exemple.fr');
    fill('auth-password', 'motdepasse1');
    fireEvent.press(screen.getByTestId('auth-submit'));

    await waitFor(() => expect(stateOf('auth-submit')).toMatchObject({ busy: true }));
    fireEvent.press(screen.getByTestId('auth-google'));
    fireEvent.press(screen.getByTestId('auth-apple'));
    expect(signInWithGoogle).not.toHaveBeenCalled();
    expect(signInWithApple).not.toHaveBeenCalled();

    finish({ ok: false, error: 'invalid_credentials' });
    await waitFor(() =>
      expect(stateOf('auth-submit')).toMatchObject({ busy: false, disabled: false }),
    );
    expect(signIn).toHaveBeenCalledTimes(1);
  });

  it('Google : le bouton tourne jusqu’à ce que la route ait fini, les autres restent bloqués', async () => {
    const signInWithGoogle = jest.fn().mockResolvedValue({
      ok: true,
      isNewUser: false,
      firstName: '',
      lastName: '',
      email: 'sofia@exemple.fr',
    });
    useAuthStore.setState({ signInWithGoogle });
    const route = deferred();
    const onSignedIn = jest.fn(() => route.promise);
    render(<SignInScreen onSignedIn={onSignedIn} />);

    fireEvent.press(screen.getByTestId('auth-google'));
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledTimes(1));
    expect(stateOf('auth-google')).toMatchObject({ busy: true, disabled: true });
    expect(stateOf('auth-apple')).toMatchObject({ disabled: true });
    expect(stateOf('auth-submit')).toMatchObject({ disabled: true });

    route.resolve();
    await waitFor(() =>
      expect(stateOf('auth-google')).toMatchObject({ busy: false, disabled: false }),
    );
    expect(stateOf('auth-apple')).toMatchObject({ disabled: false });
    expect(stateOf('auth-submit')).toMatchObject({ disabled: false });
    expect(signInWithGoogle).toHaveBeenCalledTimes(1);
  });
});

describe('<SignInScreen /> — une session ouverte ailleurs', () => {
  it('au premier plan : une session qui s’ouvre sans appui fait entrer dans l’app, une seule fois', async () => {
    const onSignedIn = jest.fn().mockResolvedValue(undefined);
    render(<SignInScreen onSignedIn={onSignedIn} />);
    expect(onSignedIn).not.toHaveBeenCalled();

    act(() => useAuthStore.setState({ status: 'authenticated' }));
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledTimes(1));
  });

  it('sous « Mot de passe oublié » (pas au premier plan) : la session du code n’y fait PAS entrer', async () => {
    const onSignedIn = jest.fn().mockResolvedValue(undefined);
    let bringToFront: () => void = () => {};
    function Host() {
      const [active, setActive] = useState(false);
      bringToFront = () => setActive(true);
      return <SignInScreen onSignedIn={onSignedIn} active={active} />;
    }
    render(<Host />);

    act(() => useAuthStore.setState({ status: 'authenticated' }));
    await act(async () => {});
    expect(onSignedIn).not.toHaveBeenCalled();

    // Revenu au premier plan avec une session : on entre.
    act(() => bringToFront());
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledTimes(1));
  });
});
