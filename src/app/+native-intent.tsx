import { isAuthCallback, resolveDeepLinkPath } from '@/shared/lib/deep-link';

/**
 * Native deep-link entry point (expo-router).
 *
 * Runs OUTSIDE React for every incoming deep / universal link before the router
 * navigates. It must never crash (a thrown error here can crash app launch), so
 * all validation lives in `resolveDeepLinkPath`, which allowlists routes and
 * falls back safely. See docs/research/01-mobile-security.md §6.
 *
 * Le retour de la page Apple (Android) n'est pas une page : la connexion en cours le reçoit déjà, le
 * routeur reste donc où il est (`null`). Au démarrage à froid — l'app a été fermée pendant que
 * l'onglet était ouvert — cette connexion n'existe plus : on repart de l'écran de connexion.
 */
export function redirectSystemPath({
  path,
  initial,
}: {
  path: string;
  initial: boolean;
}): string | null {
  try {
    if (isAuthCallback(path)) return initial ? '/sign-in' : null;
    return resolveDeepLinkPath(path);
  } catch {
    return resolveDeepLinkPath(null);
  }
}
