import { Alert } from 'react-native';

import { fireEvent, render, screen, waitFor } from '@/shared/testing/render';

import { DEMO_CODE, makeDemoSession } from '../model/demo-session';
import { useAuthStore } from '../model/store';
import { AccountScreen } from '../ui/account-screen';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
  }),
}));

const original = useAuthStore.getState();

/** Accepte la confirmation de suppression (le second bouton de l'alerte). */
const acceptAlert = () =>
  jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
    buttons?.[1]?.onPress?.();
  });

beforeEach(() => {
  jest.restoreAllMocks();
  useAuthStore.setState({
    session: null,
    status: 'unauthenticated',
    error: null,
    deleteAccount: original.deleteAccount,
    signOut: original.signOut,
    startPhoneVerification: original.startPhoneVerification,
    confirmPhone: original.confirmPhone,
  });
});

describe('<AccountScreen />', () => {
  it('sans session : propose de se connecter', () => {
    const onSignIn = jest.fn();
    render(<AccountScreen onSignIn={onSignIn} />);
    fireEvent.press(screen.getByTestId('account-sign-in'));
    expect(onSignIn).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('account-delete')).toBeNull();
  });

  it('montre l’e-mail et la méthode de connexion', () => {
    useAuthStore.setState({ session: makeDemoSession('neo@exemple.fr'), status: 'authenticated' });
    render(<AccountScreen />);
    expect(screen.getByTestId('account-email')).toHaveTextContent(/neo@exemple\.fr/);
    expect(screen.getByTestId('account-provider')).toHaveTextContent(/démonstration/);
  });

  it('un numéro vérifié s’affiche en écriture locale, avec son statut', () => {
    useAuthStore.setState({ session: makeDemoSession('+33612345678'), status: 'authenticated' });
    render(<AccountScreen />);
    expect(screen.getByTestId('account-phone')).toHaveTextContent('06 12 34 56 78');
    expect(screen.getByTestId('account-phone-status')).toHaveTextContent('Vérifié');
    expect(screen.queryByTestId('account-verify-phone')).toBeNull();
  });

  it('vérifie un numéro non vérifié par code, puis le dit', async () => {
    const session = makeDemoSession('neo@exemple.fr');
    session.user.user_metadata = { contact_phone: '+33612345678' };
    useAuthStore.setState({ session, status: 'authenticated' });
    render(<AccountScreen />);

    expect(screen.getByTestId('account-phone-status')).toHaveTextContent('Non vérifié');
    fireEvent.press(screen.getByTestId('account-verify-phone'));

    await screen.findByTestId('account-phone-step');
    fill('account-phone-input', DEMO_CODE);

    expect(await screen.findByTestId('account-phone-verified')).toBeOnTheScreen();
    expect(screen.getByTestId('account-phone-status')).toHaveTextContent('Vérifié');
  });

  it('un fournisseur de SMS absent : message clair, on reste sur le compte', async () => {
    const session = makeDemoSession('neo@exemple.fr');
    session.user.user_metadata = { contact_phone: '+33612345678' };
    useAuthStore.setState({
      session,
      status: 'authenticated',
      startPhoneVerification: jest.fn().mockResolvedValue({ ok: false, error: 'sms_unavailable' }),
    });
    render(<AccountScreen />);

    fireEvent.press(screen.getByTestId('account-verify-phone'));
    expect(await screen.findByTestId('account-phone-error')).toHaveTextContent(/SMS/);
    expect(screen.queryByTestId('account-phone-step')).toBeNull();
  });

  it('se déconnecter passe par la route quand elle le demande', () => {
    useAuthStore.setState({ session: makeDemoSession('neo@exemple.fr'), status: 'authenticated' });
    const onSignOut = jest.fn();
    render(<AccountScreen onSignOut={onSignOut} />);
    fireEvent.press(screen.getByTestId('account-sign-out'));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it('supprimer le compte : confirmation, puis la route efface le reste', async () => {
    acceptAlert();
    useAuthStore.setState({ session: makeDemoSession('neo@exemple.fr'), status: 'authenticated' });
    const onAccountDeleted = jest.fn();
    render(<AccountScreen onAccountDeleted={onAccountDeleted} />);

    fireEvent.press(screen.getByTestId('account-delete'));
    await waitFor(() => expect(onAccountDeleted).toHaveBeenCalledTimes(1));
    expect(useAuthStore.getState().status).toBe('unauthenticated');
  });

  it('une suppression refusée par le serveur garde le compte et le dit', async () => {
    acceptAlert();
    useAuthStore.setState({
      session: makeDemoSession('neo@exemple.fr'),
      status: 'authenticated',
      deleteAccount: jest.fn().mockResolvedValue({ ok: false, error: 'network' }),
    });
    const onAccountDeleted = jest.fn();
    render(<AccountScreen onAccountDeleted={onAccountDeleted} />);

    fireEvent.press(screen.getByTestId('account-delete'));
    expect(await screen.findByTestId('account-error')).toHaveTextContent(/réseau/);
    expect(onAccountDeleted).not.toHaveBeenCalled();
  });
});

function fill(testID: string, value: string) {
  fireEvent.changeText(screen.getByTestId(testID), value);
}
