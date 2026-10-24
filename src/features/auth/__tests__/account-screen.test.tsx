import type { Session } from '@supabase/supabase-js';
import { Alert } from 'react-native';

import { act, fireEvent, render, screen, waitFor } from '@/shared/testing/render';

import { makeDemoSession } from '../model/demo-session';
import { useAuthStore, type AuthResult } from '../model/store';
import { AccountScreen } from '../ui/account-screen';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
  }),
}));

/**
 * La connexion par numéro (`EXPO_PUBLIC_AUTH_PHONE`), basculée test par test. L'écran et le store
 * lisent le drapeau à chaque usage — jamais au chargement du module —, un accesseur suffit donc.
 * Il est posé APRÈS la copie du module : une copie l'appellerait avant que `mockPhoneAuth` existe.
 */
const mockPhoneAuth = { enabled: true };
jest.mock('@/shared/lib/env', () =>
  Object.defineProperty({ ...jest.requireActual('@/shared/lib/env') }, 'isPhoneAuthEnabled', {
    enumerable: true,
    get: () => mockPhoneAuth.enabled,
  }),
);

/** Le store range la session de démonstration dans le stockage sécurisé : rien de natif sous Jest. */
jest.mock('@/shared/lib/storage', () => ({
  ...jest.requireActual('@/shared/lib/storage'),
  secureStorage: {
    get: () => Promise.resolve(null),
    set: () => Promise.resolve(),
    remove: () => Promise.resolve(),
  },
}));

const original = useAuthStore.getState();

/** Accepte la confirmation de suppression (le second bouton de l'alerte). */
const acceptAlert = () =>
  jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
    buttons?.[1]?.onPress?.();
  });

/** Un compte e-mail dont le numéro, saisi à l'inscription, n'est pas encore associé. */
function withPendingPhone(): Session {
  const session = makeDemoSession('neo@exemple.fr');
  session.user.user_metadata = { contact_phone: '+33612345678' };
  return session;
}

/** Un compte e-mail dont le numéro est associé : Supabase le range sans « + », et confirmé. */
function withLinkedPhone(): Session {
  const session = makeDemoSession('neo@exemple.fr');
  session.user.phone = '33612345678';
  session.user.phone_confirmed_at = session.user.created_at;
  return session;
}

/** Une réponse qu'on donne à la main : pour voir l'écran PENDANT l'appel. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  jest.restoreAllMocks();
  mockPhoneAuth.enabled = true;
  useAuthStore.setState({
    session: null,
    status: 'unauthenticated',
    error: null,
    deleteAccount: original.deleteAccount,
    signOut: original.signOut,
    linkPhone: original.linkPhone,
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

  it('sans numéro : ni ligne « Téléphone », ni bouton pour l’associer', () => {
    useAuthStore.setState({ session: makeDemoSession('neo@exemple.fr'), status: 'authenticated' });
    render(<AccountScreen />);
    expect(screen.queryByTestId('account-phone')).toBeNull();
    expect(screen.queryByTestId('account-phone-status')).toBeNull();
    expect(screen.queryByTestId('account-link-phone')).toBeNull();
  });
});

describe('<AccountScreen /> — le numéro associé', () => {
  it('un numéro associé s’affiche en écriture locale, « Associé », sans bouton', () => {
    useAuthStore.setState({ session: withLinkedPhone(), status: 'authenticated' });
    render(<AccountScreen />);
    expect(screen.getByTestId('account-phone')).toHaveTextContent('06 12 34 56 78');
    expect(screen.getByTestId('account-phone-status')).toHaveTextContent('Associé');
    expect(screen.getByText(/vous connecter avec ce numéro et votre mot de passe/)).toBeTruthy();
    expect(screen.queryByTestId('account-link-phone')).toBeNull();
  });

  it('un numéro saisi à l’inscription, pas encore associé : « Non associé » et le bouton', () => {
    useAuthStore.setState({ session: withPendingPhone(), status: 'authenticated' });
    render(<AccountScreen />);
    expect(screen.getByTestId('account-phone')).toHaveTextContent('06 12 34 56 78');
    expect(screen.getByTestId('account-phone-status')).toHaveTextContent('Non associé');
    expect(screen.getByTestId('account-link-phone')).toHaveTextContent('Associer ce numéro');
    expect(screen.queryByTestId('account-phone-linked')).toBeNull();
  });

  it('un numéro présent sur le compte mais non confirmé n’est pas associé', () => {
    const session = makeDemoSession('neo@exemple.fr');
    session.user.phone = '33612345678';
    useAuthStore.setState({ session, status: 'authenticated' });
    render(<AccountScreen />);
    expect(screen.getByTestId('account-phone-status')).toHaveTextContent('Non associé');
    expect(screen.getByTestId('account-link-phone')).toBeOnTheScreen();
  });

  it('« Associer ce numéro » appelle linkPhone, puis le dit : le numéro passe « Associé »', async () => {
    // L'action du store, telle quelle (la démonstration rouvre la session avec le numéro associé).
    const linkPhone = jest.fn(original.linkPhone);
    useAuthStore.setState({ session: withPendingPhone(), status: 'authenticated', linkPhone });
    render(<AccountScreen />);

    fireEvent.press(screen.getByTestId('account-link-phone'));

    expect(await screen.findByTestId('account-phone-linked')).toHaveTextContent(/Numéro associé/);
    expect(linkPhone).toHaveBeenCalledTimes(1);
    expect(linkPhone).toHaveBeenCalledWith('+33612345678');
    expect(screen.getByTestId('account-phone-status')).toHaveTextContent('Associé');
    expect(screen.queryByTestId('account-link-phone')).toBeNull();
    expect(screen.queryByTestId('account-phone-error')).toBeNull();
  });

  it('pendant l’association, le bouton patiente : un second appui ne relance rien', async () => {
    const pending = deferred<AuthResult>();
    const linkPhone = jest.fn(() => pending.promise);
    useAuthStore.setState({ session: withPendingPhone(), status: 'authenticated', linkPhone });
    render(<AccountScreen />);

    fireEvent.press(screen.getByTestId('account-link-phone'));
    expect(screen.getByTestId('account-link-phone')).toBeDisabled();
    expect(screen.getByTestId('account-link-phone')).toBeBusy();
    fireEvent.press(screen.getByTestId('account-link-phone'));
    expect(linkPhone).toHaveBeenCalledTimes(1);
    // Rien n'est encore dit tant que le serveur n'a pas répondu.
    expect(screen.getByTestId('account-phone-status')).toHaveTextContent('Non associé');
    expect(screen.queryByTestId('account-phone-linked')).toBeNull();

    await act(async () => pending.resolve({ ok: true }));
    expect(await screen.findByTestId('account-phone-linked')).toBeOnTheScreen();
  });

  it('associé, mais session pas encore rafraîchie : la réponse du serveur fait foi, « Associé »', async () => {
    // Le serveur a accepté, mais la session n'a pas pu être relue : elle garde l'ancien état.
    const session = withPendingPhone();
    const linkPhone = jest.fn().mockResolvedValue({ ok: true });
    useAuthStore.setState({ session, status: 'authenticated', linkPhone });
    render(<AccountScreen />);
    expect(screen.getByTestId('account-phone-status')).toHaveTextContent('Non associé');

    fireEvent.press(screen.getByTestId('account-link-phone'));

    expect(await screen.findByTestId('account-phone-linked')).toHaveTextContent(/Numéro associé/);
    // La session est bien restée telle quelle : seul l'écran sait que c'est fait.
    expect(useAuthStore.getState().session).toBe(session);
    expect(useAuthStore.getState().session?.user.phone_confirmed_at).toBeUndefined();
    expect(screen.getByTestId('account-phone-status')).toHaveTextContent(/^Associé$/);
    expect(screen.queryByText('Non associé')).toBeNull();
    expect(screen.queryByTestId('account-link-phone')).toBeNull();
    expect(screen.queryByTestId('account-phone-error')).toBeNull();
    expect(linkPhone).toHaveBeenCalledTimes(1);
  });

  it('un numéro déjà pris : message clair, on reste sur le compte, « Non associé »', async () => {
    const linkPhone = jest.fn().mockResolvedValue({ ok: false, error: 'phone_taken' });
    useAuthStore.setState({ session: withPendingPhone(), status: 'authenticated', linkPhone });
    render(<AccountScreen />);

    fireEvent.press(screen.getByTestId('account-link-phone'));

    expect(await screen.findByTestId('account-phone-error')).toHaveTextContent(
      'Ce numéro est déjà associé à un autre compte. Connectez-vous avec votre e-mail.',
    );
    expect(screen.getByTestId('account-screen')).toBeOnTheScreen();
    expect(screen.getByTestId('account-phone-status')).toHaveTextContent('Non associé');
    expect(screen.queryByTestId('account-phone-linked')).toBeNull();
    // Le bouton reste là, et redevient utilisable.
    expect(screen.getByTestId('account-link-phone')).toBeEnabled();
  });

  it('un échec réseau, puis un nouvel essai réussi : l’erreur disparaît', async () => {
    const linkPhone = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, error: 'network' })
      .mockResolvedValueOnce({ ok: true });
    useAuthStore.setState({ session: withPendingPhone(), status: 'authenticated', linkPhone });
    render(<AccountScreen />);

    fireEvent.press(screen.getByTestId('account-link-phone'));
    expect(await screen.findByTestId('account-phone-error')).toHaveTextContent(/réseau/);

    fireEvent.press(screen.getByTestId('account-link-phone'));
    expect(await screen.findByTestId('account-phone-linked')).toBeOnTheScreen();
    expect(screen.queryByTestId('account-phone-error')).toBeNull();
    expect(screen.getByTestId('account-phone-status')).toHaveTextContent(/^Associé$/);
    expect(linkPhone).toHaveBeenCalledTimes(2);
    expect(linkPhone).toHaveBeenLastCalledWith('+33612345678');
  });

  it('connexion par numéro désactivée : le numéro s’affiche, sans bouton pour l’associer', () => {
    mockPhoneAuth.enabled = false;
    useAuthStore.setState({ session: withPendingPhone(), status: 'authenticated' });
    render(<AccountScreen />);
    expect(screen.getByTestId('account-phone')).toHaveTextContent('06 12 34 56 78');
    expect(screen.getByTestId('account-phone-status')).toHaveTextContent('Non associé');
    expect(screen.queryByTestId('account-link-phone')).toBeNull();
    expect(screen.queryByText(/Associez-le/)).toBeNull();
  });
});

describe('<AccountScreen /> — quitter ou supprimer', () => {
  it('se déconnecter passe par la route quand elle le demande', () => {
    const signOut = jest.fn().mockResolvedValue(undefined);
    useAuthStore.setState({
      session: makeDemoSession('neo@exemple.fr'),
      status: 'authenticated',
      signOut,
    });
    const onSignOut = jest.fn();
    render(<AccountScreen onSignOut={onSignOut} />);
    fireEvent.press(screen.getByTestId('account-sign-out'));
    expect(onSignOut).toHaveBeenCalledTimes(1);
    // La route s'en charge (et remet l'app à zéro) : l'écran ne ferme pas la session lui-même.
    expect(signOut).not.toHaveBeenCalled();
  });

  it('sans route : se déconnecter ferme seulement la session', () => {
    const signOut = jest.fn().mockResolvedValue(undefined);
    useAuthStore.setState({
      session: makeDemoSession('neo@exemple.fr'),
      status: 'authenticated',
      signOut,
    });
    render(<AccountScreen />);
    fireEvent.press(screen.getByTestId('account-sign-out'));
    expect(signOut).toHaveBeenCalledTimes(1);
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
    // Le bouton redevient utilisable : on peut réessayer.
    expect(screen.getByTestId('account-delete')).toBeEnabled();
    expect(screen.getByTestId('account-screen')).toBeOnTheScreen();
  });
});
