// URL polyfill is required for supabase-js on React Native (Hermes URL is incomplete).
import 'react-native-url-polyfill/auto';
import { createClient, processLock } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { env } from './env';
import { LargeSecureStore } from './storage';

/**
 * PKCE en S256 (RFC 7636 §4.2). auth-js hache le vérificateur avec `crypto.subtle.digest`, absent
 * de React Native (seul `getRandomValues` y est fourni) : sans lui, il passe en « plain » et met le
 * vérificateur EN CLAIR dans l'adresse d'autorisation (connexion Apple sur Android). On fournit ce
 * seul `digest` (SHA-256), par expo-crypto, chargé au premier usage.
 */
function provideSha256ForPkce(): void {
  if (Platform.OS === 'web') return;
  const webCrypto = (globalThis as { crypto?: { subtle?: unknown } }).crypto;
  if (!webCrypto || webCrypto.subtle !== undefined) return;
  webCrypto.subtle = {
    digest: async (
      algorithm: string | { name: string },
      data: BufferSource,
    ): Promise<ArrayBuffer> => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- why: module natif, chargé au premier usage
      const Crypto = require('expo-crypto') as typeof import('expo-crypto');
      const name = typeof algorithm === 'string' ? algorithm : algorithm.name;
      if (name.toUpperCase() !== Crypto.CryptoDigestAlgorithm.SHA256) {
        throw new Error(`digest : seul SHA-256 est fourni (demandé : ${name}).`);
      }
      return Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, data);
    },
  };
}
provideSha256ForPkce();

/** Où la session est rangée : chiffrée sur téléphone ; le stockage par défaut sur le web. */
const sessionStore = Platform.OS !== 'web' ? new LargeSecureStore() : undefined;

/**
 * The Supabase client. Security-critical configuration — read before changing:
 *
 * - **Session lives in `LargeSecureStore`** (AES + Keychain), NOT AsyncStorage.
 *   A Supabase session exceeds the iOS Keychain's ~2KB limit, so we encrypt it.
 * - **`flowType: 'pkce'`** — mandatory for a public mobile client; an intercepted
 *   OAuth code is useless without the locally-stored verifier.
 * - **`detectSessionInUrl: false`** — that is a web-only mechanism; native gets the
 *   callback via a (verified) deep link and exchanges the code explicitly.
 * - **`lock: processLock`** — serialises concurrent token refreshes.
 * - We ship the **anon/publishable** key only (env.ts rejects a service_role key).
 *   The real authorization boundary is **RLS** — see supabase/migrations and
 *   docs/architecture/backend.md.
 *
 * NOTE: run `supabase gen types typescript` and pass `createClient<Database>` once
 * you have a schema, to get end-to-end typed queries.
 */
export const supabase = createClient(
  env.EXPO_PUBLIC_SUPABASE_URL,
  env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      // SecureStore is unavailable on web; let supabase-js use its web default there.
      ...(sessionStore ? { storage: sessionStore } : {}),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
      lock: processLock,
    },
  },
);

/**
 * Efface la session rangée sur l'appareil, SANS le serveur. supabase-js le fait lui-même quand la
 * déconnexion aboutit ; mais hors ligne, avec un jeton expiré, il rend une erreur AVANT d'effacer
 * (la session reviendrait au prochain lancement). La déconnexion appelle donc ceci en secours.
 */
export async function forgetStoredSession(): Promise<void> {
  // why: `storageKey` n'est pas exposé dans les types publics d'auth-js, mais c'est la clé exacte
  // sous laquelle il range la session (« sb-<projet>-auth-token » par défaut).
  const key = (supabase.auth as unknown as { storageKey?: unknown }).storageKey;
  if (typeof key !== 'string' || key === '') return;
  for (const item of [key, `${key}-code-verifier`, `${key}-user`]) {
    try {
      if (sessionStore) await sessionStore.removeItem(item);
      else globalThis.localStorage?.removeItem(item);
    } catch {
      // Rien à effacer, ou stockage indisponible : on continue avec la clé suivante.
    }
  }
}

/**
 * Refresh the session only while the app is foregrounded (native). Call once at
 * app start (wired in `src/app/_layout.tsx`). No-op on web.
 */
export function registerSupabaseAutoRefresh(): () => void {
  if (Platform.OS === 'web') return () => {};
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
  return () => sub.remove();
}
