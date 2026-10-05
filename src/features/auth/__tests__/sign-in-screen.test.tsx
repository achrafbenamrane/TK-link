import { fireEvent, render, screen, waitFor } from '@/shared/testing/render';

import { useAuthStore } from '../model/store';
import { SignInScreen } from '../ui/sign-in-screen';

const fill = (testID: string, value: string) =>
  fireEvent.changeText(screen.getByTestId(testID), value);

const originalSignIn = useAuthStore.getState().signIn;

beforeEach(() => {
  useAuthStore.setState({ error: null, signIn: originalSignIn });
});

describe('<SignInScreen />', () => {
  it('affiche le formulaire et ne propose les raccourcis que si la route les branche', () => {
    render(<SignInScreen />);
    expect(screen.getByTestId('sign-in-screen')).toBeOnTheScreen();
    expect(screen.getByTestId('auth-email')).toBeOnTheScreen();
    expect(screen.getByTestId('auth-password')).toBeOnTheScreen();
    expect(screen.getByTestId('auth-submit')).toBeOnTheScreen();
    expect(screen.queryByTestId('auth-toggle')).toBeNull();
    expect(screen.queryByTestId('auth-merchant')).toBeNull();
  });

  it('signale l’e-mail et le mot de passe invalides sous leur champ, sans appeler le store', async () => {
    const signIn = jest.fn();
    useAuthStore.setState({ signIn });
    render(<SignInScreen />);

    fill('auth-email', 'pas-un-email');
    fill('auth-password', 'court');
    fireEvent.press(screen.getByTestId('auth-submit'));

    expect(await screen.findByTestId('auth-email-error')).toHaveTextContent(
      'Entrez une adresse e-mail valide.',
    );
    expect(screen.getByTestId('auth-password-error')).toHaveTextContent(/au moins 8 caractères/);
    expect(signIn).not.toHaveBeenCalled();

    // Corriger un champ efface son erreur, pas celle de l’autre.
    fill('auth-email', 'neo@exemple.fr');
    expect(screen.queryByTestId('auth-email-error')).toBeNull();
    expect(screen.getByTestId('auth-password-error')).toBeOnTheScreen();
  });

  it('envoie l’e-mail nettoyé et le mot de passe au store, puis prévient la route', async () => {
    const signIn = jest.fn().mockResolvedValue({ ok: true });
    useAuthStore.setState({ signIn });
    const onSignedIn = jest.fn();
    render(<SignInScreen onSignedIn={onSignedIn} />);

    fill('auth-email', '  neo@exemple.fr ');
    fill('auth-password', 'motdepasse1');
    fireEvent.press(screen.getByTestId('auth-submit'));

    await waitFor(() => expect(onSignedIn).toHaveBeenCalledTimes(1));
    expect(signIn).toHaveBeenCalledWith('neo@exemple.fr', 'motdepasse1');
    expect(screen.queryByTestId('auth-error')).toBeNull();
  });

  it('affiche l’erreur du serveur en français et ne quitte pas l’écran', async () => {
    const signIn = jest.fn().mockImplementation(async () => {
      useAuthStore.setState({ error: 'Invalid login credentials' });
      return { ok: false, error: 'Invalid login credentials' };
    });
    useAuthStore.setState({ signIn });
    const onSignedIn = jest.fn();
    render(<SignInScreen onSignedIn={onSignedIn} />);

    fill('auth-email', 'neo@exemple.fr');
    fill('auth-password', 'motdepasse1');
    fireEvent.press(screen.getByTestId('auth-submit'));

    expect(await screen.findByTestId('auth-error')).toHaveTextContent(
      'Adresse e-mail ou mot de passe incorrect.',
    );
    expect(onSignedIn).not.toHaveBeenCalled();
  });

  it('n’affiche pas l’erreur d’une session précédente à l’ouverture', () => {
    useAuthStore.setState({ error: 'Invalid login credentials' });
    render(<SignInScreen />);
    expect(screen.queryByTestId('auth-error')).toBeNull();
  });

  it('renvoie vers l’inscription consommateur et l’inscription commerçant', () => {
    const onCreateAccount = jest.fn();
    const onMerchantSignUp = jest.fn();
    render(<SignInScreen onCreateAccount={onCreateAccount} onMerchantSignUp={onMerchantSignUp} />);

    fireEvent.press(screen.getByTestId('auth-toggle'));
    fireEvent.press(screen.getByTestId('auth-merchant'));

    expect(onCreateAccount).toHaveBeenCalledTimes(1);
    expect(onMerchantSignUp).toHaveBeenCalledTimes(1);
  });
});
