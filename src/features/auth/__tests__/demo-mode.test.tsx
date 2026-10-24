import { supabase } from '@/shared/lib/supabase';
import { act, fireEvent, render, screen, waitFor } from '@/shared/testing/render';

import { describeAccount } from '../model/account';
import { isDemoSession, makeDemoSession, DEMO_TOKEN } from '../model/demo-session';
import { useAuthStore } from '../model/store';
import { SignUpScreen } from '../ui/sign-up-screen';

/**
 * Le mode démonstration : ce qui se passe quand aucun back-end n'est branché.
 *
 * Les tests tournent SANS variables Supabase (le `.env` du dépôt n'en définit
 * pas), donc `isSupabaseConfigured` vaut `false` ici — c'est exactement le
 * chemin qu'on veut couvrir.
 */

/**
 * Le trousseau du téléphone, simulé en mémoire (comme dans `demo-flows.test.ts`) : la démonstration
 * y range sa session, et `init` l'y relit.
 */
const mockKeychain = new Map<string, string>();
jest.mock('@/shared/lib/storage', () => ({
  ...jest.requireActual('@/shared/lib/storage'),
  secureStorage: {
    get: jest.fn((key: string) => Promise.resolve(mockKeychain.get(key) ?? null)),
    set: jest.fn((key: string, value: string) => {
      mockKeychain.set(key, value);
      return Promise.resolve();
    }),
    remove: jest.fn((key: string) => {
      mockKeychain.delete(key);
      return Promise.resolve();
    }),
  },
}));

/** Laisse aboutir ce qui attend encore : la lecture du trousseau est asynchrone. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  mockKeychain.clear();
  useAuthStore.setState({ session: null, status: 'unauthenticated', error: null });
});

describe('session de démonstration', () => {
  it('porte un jeton reconnaissable et l’e-mail saisi', () => {
    const session = makeDemoSession('sofiane@exemple.fr', 1_786_000_000_000);

    expect(session.access_token).toBe(DEMO_TOKEN);
    expect(session.user.email).toBe('sofiane@exemple.fr');
    expect(isDemoSession(session)).toBe(true);
    expect(isDemoSession(null)).toBe(false);
  });

  it('expire — une session de démonstration n’est pas éternelle', () => {
    const now = 1_786_000_000_000;
    const session = makeDemoSession('a@b.fr', now);
    expect(session.expires_at).toBe(Math.floor(now / 1000) + 3600);
  });
});

describe('store sans back-end', () => {
  it('signale le mode démonstration', () => {
    expect(useAuthStore.getState().demoMode).toBe(true);
  });

  it('l’inscription ouvre une session locale au lieu d’échouer sur le réseau', async () => {
    const result = await useAuthStore.getState().signUp('achraf@exemple.fr', 'motdepasse1');

    expect(result.ok).toBe(true);
    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(isDemoSession(useAuthStore.getState().session)).toBe(true);
    expect(useAuthStore.getState().session?.user.email).toBe('achraf@exemple.fr');
  });

  it('la connexion aussi', async () => {
    const result = await useAuthStore.getState().signIn('achraf@exemple.fr', 'motdepasse1');
    expect(result.ok).toBe(true);
    expect(useAuthStore.getState().status).toBe('authenticated');
  });

  it('mais la validation locale reste appliquée', async () => {
    // Un e-mail invalide ne doit pas ouvrir de session sous prétexte qu'on est
    // hors ligne : c'est la seule vérification qui nous reste.
    const bad = await useAuthStore.getState().signUp('pas-un-email', 'motdepasse1');
    expect(bad.ok).toBe(false);
    expect(useAuthStore.getState().status).toBe('unauthenticated');

    const short = await useAuthStore.getState().signIn('a@b.fr', '123');
    expect(short.ok).toBe(false);
    expect(useAuthStore.getState().status).toBe('unauthenticated');
  });

  it('la déconnexion referme la session', async () => {
    await useAuthStore.getState().signIn('achraf@exemple.fr', 'motdepasse1');
    await useAuthStore.getState().signOut();

    expect(useAuthStore.getState().session).toBeNull();
    expect(useAuthStore.getState().status).toBe('unauthenticated');
  });

  it('la suppression de compte réussit sans serveur à appeler', async () => {
    await useAuthStore.getState().signIn('achraf@exemple.fr', 'motdepasse1');
    const result = await useAuthStore.getState().deleteAccount();

    expect(result.ok).toBe(true);
    expect(useAuthStore.getState().status).toBe('unauthenticated');
  });

  it('`init` n’interroge aucun serveur et rend un désabonnement inerte', async () => {
    const getSession = jest.spyOn(supabase.auth, 'getSession');
    const onAuthStateChange = jest.spyOn(supabase.auth, 'onAuthStateChange');
    useAuthStore.setState({ status: 'loading' });

    const unsubscribe = useAuthStore.getState().init();
    // Rien n'est encore décidé : la lecture du trousseau n'a pas répondu.
    expect(useAuthStore.getState().status).toBe('loading');
    expect(getSession).not.toHaveBeenCalled();
    expect(onAuthStateChange).not.toHaveBeenCalled();

    await settle();
    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(getSession).not.toHaveBeenCalled();
    expect(onAuthStateChange).not.toHaveBeenCalled();
    expect(() => unsubscribe()).not.toThrow();

    getSession.mockRestore();
    onAuthStateChange.mockRestore();
  });
});

describe('un compte est obligatoire, même en démonstration', () => {
  it.each(['consommateur', 'commercant', 'grossiste', 'livreur'] as const)(
    'l’inscription (%s) ne propose plus de « Continuer sans compte »',
    async (role) => {
      render(<SignUpScreen role={role} />);
      // Les icônes chargent leur police en tâche de fond : on laisse ce rendu aboutir.
      await act(async () => {});

      expect(screen.getByTestId('signup-submit')).toBeTruthy();
      // Le bas du formulaire, où se trouvait le lien, est bien rendu : l'absence n'est pas vide de sens.
      expect(
        screen.getByTestId(role === 'commercant' ? 'signup-free-ops' : 'signup-alternatives'),
      ).toBeTruthy();
      expect(screen.queryByTestId('signup-skip')).toBeNull();
      // Le lien était un bouton nommé par son `accessibilityLabel`, pas par un texte visible.
      expect(screen.queryByLabelText(/sans compte/i)).toBeNull();
      expect(screen.queryByText(/sans compte/i)).toBeNull();
    },
  );
});

describe('Google et Apple à l’inscription, en démonstration', () => {
  it('le numéro tapé dans le formulaire est associé juste après la connexion Google', async () => {
    const onSignedUp = jest.fn();
    render(<SignUpScreen role="consommateur" onSignedUp={onSignedUp} />);
    await act(async () => {});

    fireEvent.changeText(screen.getByTestId('signup-phone'), '06 12 34 56 78');
    fireEvent.press(screen.getByTestId('signup-terms'));
    fireEvent.press(screen.getByTestId('auth-google'));

    await waitFor(() => expect(onSignedUp).toHaveBeenCalledTimes(1));
    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(describeAccount(useAuthStore.getState().session)).toMatchObject({
      email: 'alex.demo@gmail.com',
      phone: '+33612345678',
      phoneLinked: true,
      provider: 'google',
    });
  });

  it('sans numéro tapé, la session Google reste sans numéro', async () => {
    const onSignedUp = jest.fn();
    render(<SignUpScreen role="consommateur" onSignedUp={onSignedUp} />);
    await act(async () => {});

    fireEvent.press(screen.getByTestId('signup-terms'));
    fireEvent.press(screen.getByTestId('auth-google'));

    await waitFor(() => expect(onSignedUp).toHaveBeenCalledTimes(1));
    expect(describeAccount(useAuthStore.getState().session)).toMatchObject({
      email: 'alex.demo@gmail.com',
      phone: null,
      phoneLinked: false,
      provider: 'google',
    });
  });
});
