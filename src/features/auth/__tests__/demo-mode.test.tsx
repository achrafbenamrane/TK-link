import { isDemoSession, makeDemoSession, DEMO_TOKEN } from '../model/demo-session';
import { useAuthStore } from '../model/store';

/**
 * Le mode démonstration : ce qui se passe quand aucun back-end n'est branché.
 *
 * Les tests tournent SANS variables Supabase (le `.env` du dépôt n'en définit
 * pas), donc `isSupabaseConfigured` vaut `false` ici — c'est exactement le
 * chemin qu'on veut couvrir.
 */

beforeEach(() => {
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

  it('`init` n’interroge aucun serveur et rend un désabonnement inerte', () => {
    const unsubscribe = useAuthStore.getState().init();

    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(() => unsubscribe()).not.toThrow();
  });
});
