import { needsSiret } from './registration';

import type { Role } from '@/shared/lib/roles';

/**
 * LA PORTE D'ENTRÉE — un compte est OBLIGATOIRE (décision du client, 24/10/2026).
 *
 * L'app ne se parcourt plus sans compte : tant qu'aucune session n'existe, seuls le logo animé, le
 * choix du profil, l'inscription, la connexion et le mot de passe oublié sont ouverts. Une fois
 * connecté, le parcours d'accueil (centres d'intérêt, dossier pro, dossier livreur) se termine
 * avant d'entrer dans l'app.
 *
 * Une règle PURE : le layout lui donne l'état, elle répond « reste là » (`null`) ou « va là ».
 * Elle ne connaît ni les stores ni le routeur — ce qui la rend testable seule. C'est aussi la SEULE
 * à naviguer au lancement : le logo animé se contente de dire qu'il a fini.
 */
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export type EntryState = {
  /** Les stores locaux (profil, accueil) ont été relus depuis le disque. */
  hydrated: boolean;
  /** Le logo animé a été joué depuis l'ouverture de l'app. */
  splashDone: boolean;
  auth: AuthStatus;
  /** Le parcours d'accueil local (centres d'intérêt…) est terminé sur cet appareil. */
  onboardingCompleted: boolean;
  role: Role;
  /** Le premier segment de la route courante (`''` pour l'accueil). */
  here: string;
};

/** Les étapes d'accueil, une par profil. */
export type FirstRunRoute = '/devenir-livreur' | '/dossier-pro' | '/onboarding';

/** Les seules destinations de la porte. */
export type EntryRoute = '/' | '/welcome' | '/role' | '/sign-in' | FirstRunRoute;

/** Ouverts sans compte. */
export const PUBLIC_ROUTES: ReadonlySet<string> = new Set([
  'welcome',
  'role',
  'sign-in',
  'sign-up',
  'forgot-password',
]);

/**
 * Ouverts à un compte connecté dont l'accueil n'est pas fini. L'inscription, la connexion et le mot
 * de passe oublié en font partie : la session s'y ouvre EN COURS de route (avant le code e-mail, ou
 * juste après), et l'écran doit pouvoir finir ce qu'il affiche — associer le numéro, relire le type
 * de compte sur le serveur — avant de passer la main.
 */
export const SETUP_ROUTES: ReadonlySet<string> = new Set([
  'onboarding',
  'devenir-livreur',
  'dossier-pro',
  'sign-up',
  'sign-in',
  'forgot-password',
]);

/** La première étape d'accueil d'un profil, juste après l'inscription. */
export function firstRunRoute(role: Role): FirstRunRoute {
  if (role === 'livreur') return '/devenir-livreur';
  if (needsSiret(role)) return '/dossier-pro';
  return '/onboarding';
}

/**
 * Où aller une fois l'inscription faite. Google et Apple ne distinguent pas créer et retrouver un
 * compte : « Créer un compte » avec un compte déjà inscrit est une reconnexion, et si ce compte a
 * déjà fait l'accueil (`onboarded`, retenu par le serveur), il entre directement dans l'app.
 */
export function afterSignUpRoute(role: Role, onboarded: boolean): FirstRunRoute | '/' {
  return onboarded ? '/' : firstRunRoute(role);
}

/**
 * Où aller après le logo animé, et après une connexion. Aussi la destination par défaut quand la
 * porte ramène quelqu'un.
 *
 * Un compte déconnecté qui avait déjà installé l'app (session expirée) va à la CONNEXION, pas au
 * choix du profil : il a déjà un compte. Se déconnecter, en revanche, remet l'accueil à zéro (voir
 * `useSignOut`) : la personne suivante repart du choix du profil.
 */
export function homeFor(
  state: Pick<EntryState, 'auth' | 'onboardingCompleted' | 'role'>,
): EntryRoute {
  if (state.auth !== 'authenticated') return state.onboardingCompleted ? '/sign-in' : '/role';
  return state.onboardingCompleted ? '/' : firstRunRoute(state.role);
}

/** `null` : rester. Sinon, la route où aller. */
export function decideEntry(state: EntryState): EntryRoute | null {
  if (!state.hydrated) return null;

  // À chaque ouverture, le logo animé d'abord. Il ne dépend pas de la session : il joue pendant
  // qu'on la relit.
  if (!state.splashDone) return state.here === 'welcome' ? null : '/welcome';

  // Rien d'autre n'est décidé tant que la session n'est pas relue : sinon un compte connecté
  // verrait passer le choix du profil le temps d'un éclair.
  if (state.auth === 'loading') return null;
  if (state.here === 'welcome') return homeFor(state);

  if (state.auth === 'unauthenticated') {
    return PUBLIC_ROUTES.has(state.here) ? null : homeFor(state);
  }
  if (!state.onboardingCompleted) {
    return SETUP_ROUTES.has(state.here) ? null : firstRunRoute(state.role);
  }
  // Connecté et installé : choisir un profil n'a plus de sens. La connexion et l'inscription, elles,
  // restent ouvertes le temps que leur écran termine (voir `SETUP_ROUTES`).
  return state.here === 'role' ? '/' : null;
}
