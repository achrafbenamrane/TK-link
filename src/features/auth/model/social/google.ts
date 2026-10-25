import { Platform } from 'react-native';

import { env, isGoogleConfigured } from '@/shared/lib/env';

import type { SocialResult } from './types';

/**
 * CONNEXION GOOGLE — la fenêtre native de Google, via `@react-native-google-signin`.
 *
 * Le module est chargé À LA DEMANDE (comme Mapbox) : le web et les tests n'ont pas de module natif,
 * et une build sans Google configuré ne doit pas planter au démarrage. Il n'est lu qu'au premier
 * appui sur le bouton.
 *
 * Prérequis, tous côté console et jamais dans le code :
 *  - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` : l'identifiant client « Application Web ». C'est LUI que
 *    Supabase attend comme destinataire du jeton ; il se déclare aussi dans Supabase
 *    (Authentication → Providers → Google → Client IDs).
 *  - `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` : l'identifiant client iOS (et son schéma inversé dans
 *    `app.config.ts`, pour le retour de la fenêtre Google).
 *  - Android : un client OAuth « Android » par variante de l'app, avec l'empreinte SHA-1 de sa clé
 *    de signature. Sans lui, Google répond `DEVELOPER_ERROR`.
 * Le pas-à-pas est dans `docs/security/authentication.md`.
 */
type GoogleModule = typeof import('@react-native-google-signin/google-signin');

let loaded: GoogleModule | null | undefined;
let configured = false;

function loadGoogle(): GoogleModule | null {
  if (Platform.OS === 'web') return null;
  if (loaded !== undefined) return loaded;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- why: chargement paresseux, natif seulement
    loaded = require('@react-native-google-signin/google-signin') as GoogleModule;
  } catch {
    loaded = null;
  }
  return loaded;
}

function configure(google: GoogleModule): void {
  if (configured) return;
  google.GoogleSignin.configure({
    webClientId: env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    ...(env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
      ? { iosClientId: env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID }
      : {}),
    scopes: ['email', 'profile'],
  });
  configured = true;
}

async function forgetCachedAccount(google: GoogleModule): Promise<void> {
  try {
    if (google.GoogleSignin.hasPreviousSignIn()) await google.GoogleSignin.signOut();
  } catch {
    // Rien de mémorisé, ou hors ligne : la fenêtre s'ouvre quand même.
  }
}

/** La fenêtre Google : un jeton d'identité, ou la raison pour laquelle il n'y en a pas. */
export async function googleIdentity(): Promise<SocialResult> {
  const google = loadGoogle();
  if (!google || !isGoogleConfigured) return { ok: false, code: 'unavailable' };

  try {
    configure(google);
    // Android : propose d'installer / mettre à jour les services Google Play s'ils manquent.
    await google.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    // Google rouvre sinon, SANS rien demander, le dernier compte utilisé dans l'app : on l'oublie
    // pour que la liste des comptes du téléphone s'affiche à chaque fois. (Avec UN SEUL compte
    // Google sur le téléphone, Android le prend d'office : c'est le système, pas l'app.)
    await forgetCachedAccount(google);

    const response = await google.GoogleSignin.signIn();
    if (response.type === 'cancelled') return { ok: false, code: 'cancelled' };

    const { idToken, user } = response.data;
    if (!idToken) return { ok: false, code: 'unknown' };
    return {
      ok: true,
      idToken,
      ...(user.givenName ? { firstName: user.givenName } : {}),
      ...(user.familyName ? { lastName: user.familyName } : {}),
      ...(user.email ? { email: user.email } : {}),
    };
  } catch (error) {
    if (google.isErrorWithCode(error)) {
      const { statusCodes } = google;
      // Une fenêtre déjà ouverte : un second appui n'est pas une erreur à montrer.
      if (error.code === statusCodes.SIGN_IN_CANCELLED || error.code === statusCodes.IN_PROGRESS) {
        return { ok: false, code: 'cancelled' };
      }
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return { ok: false, code: 'unavailable' };
      }
    }
    return { ok: false, code: 'unknown' };
  }
}

/**
 * Oublie le compte Google mémorisé : à la déconnexion, le prochain « Continuer avec Google »
 * doit proposer de CHOISIR un compte, pas rouvrir celui de la personne précédente (téléphone
 * partagé). `revoke` retire en plus l'autorisation donnée à l'app — suppression de compte.
 */
export async function googleSignOut(options: { revoke?: boolean } = {}): Promise<void> {
  const google = loadGoogle();
  if (!google || !isGoogleConfigured) return;
  try {
    configure(google);
    if (options.revoke) await google.GoogleSignin.revokeAccess();
    else if (google.GoogleSignin.hasPreviousSignIn()) await google.GoogleSignin.signOut();
  } catch {
    // Rien à défaire : la personne ne s'était pas connectée avec Google.
  }
}
