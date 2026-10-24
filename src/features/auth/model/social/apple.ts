import { Platform } from 'react-native';

import type { SocialResult } from './types';

/**
 * CONNEXION APPLE — la feuille native « Se connecter avec Apple », via `expo-apple-authentication`.
 *
 * iOS seulement. Sur Android, Apple n'a pas de fenêtre native : il faudrait un parcours web avec
 * retour par lien, ce que la règle de sécurité du projet (SEC-AUTH-002) réserve aux liens vérifiés.
 * Le bouton est donc masqué hors iOS ; la règle 4.8 de l'App Store (offrir Apple dès qu'on offre
 * Google) ne concerne d'ailleurs que les builds iOS.
 *
 * Le NONCE : l'app en tire un au hasard, donne son empreinte SHA-256 à Apple, et le nonce brut à
 * Supabase. Le jeton d'identité d'Apple porte l'empreinte ; Supabase recalcule celle du nonce reçu
 * et compare. Un jeton intercepté ne sert à rien sans le nonce, qui ne quitte jamais l'appareil
 * avant l'appel à Supabase.
 *
 * Le NOM : Apple ne le donne qu'à la TOUTE PREMIÈRE connexion. Il est donc rendu ici, et c'est
 * l'appelant qui doit le ranger tout de suite (voir `store.signInWithApple`) : on ne le reverra pas.
 */
type AppleModule = typeof import('expo-apple-authentication');
type CryptoModule = typeof import('expo-crypto');

let apple: AppleModule | null | undefined;
let crypto: CryptoModule | null | undefined;

function loadModules(): { apple: AppleModule; crypto: CryptoModule } | null {
  if (Platform.OS !== 'ios') return null;
  try {
    /* eslint-disable @typescript-eslint/no-require-imports -- why: chargement paresseux, natif seulement */
    apple ??= require('expo-apple-authentication') as AppleModule;
    crypto ??= require('expo-crypto') as CryptoModule;
    /* eslint-enable @typescript-eslint/no-require-imports */
  } catch {
    apple = null;
    crypto = null;
  }
  return apple && crypto ? { apple, crypto } : null;
}

/** Le bouton Apple a-t-il lieu d'être ? iOS 13+ avec la capacité activée. */
export async function isAppleAvailable(): Promise<boolean> {
  const modules = loadModules();
  if (!modules) return false;
  try {
    return await modules.apple.isAvailableAsync();
  } catch {
    return false;
  }
}

/** 32 octets au hasard, en hexadécimal. */
function randomNonce(crypto: CryptoModule): string {
  return Array.from(crypto.getRandomBytes(32), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function appleIdentity(): Promise<SocialResult> {
  const modules = loadModules();
  if (!modules) return { ok: false, code: 'unavailable' };
  const { apple, crypto } = modules;

  try {
    const nonce = randomNonce(crypto);
    const hashedNonce = await crypto.digestStringAsync(crypto.CryptoDigestAlgorithm.SHA256, nonce);

    const credential = await apple.signInAsync({
      requestedScopes: [
        apple.AppleAuthenticationScope.FULL_NAME,
        apple.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
    if (!credential.identityToken) return { ok: false, code: 'unknown' };

    const { givenName, familyName } = credential.fullName ?? {};
    return {
      ok: true,
      idToken: credential.identityToken,
      nonce,
      ...(givenName ? { firstName: givenName } : {}),
      ...(familyName ? { lastName: familyName } : {}),
      ...(credential.email ? { email: credential.email } : {}),
    };
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === 'ERR_REQUEST_CANCELED') return { ok: false, code: 'cancelled' };
    return { ok: false, code: 'unknown' };
  }
}
