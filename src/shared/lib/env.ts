import { z } from 'zod';

/**
 * Runtime-validated environment. Import `env` instead of touching
 * `process.env` anywhere else in the codebase (enforced in review).
 *
 * Only EXPO_PUBLIC_* variables are inlined into the client bundle.
 * Secrets NEVER belong here — they live on the server or in EAS secrets.
 */
/** « 123456789012-abc123def456.apps.googleusercontent.com », ou vide quand Google n'est pas branché. */
const GoogleClientId = z
  .string()
  .refine((v) => v === '' || /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/i.test(v), {
    error: 'Un identifiant client Google ressemble à « 1234-abcd.apps.googleusercontent.com ».',
  });

const EnvSchema = z.object({
  EXPO_PUBLIC_API_URL: z.url({ error: 'EXPO_PUBLIC_API_URL must be a valid URL' }),
  EXPO_PUBLIC_APP_ENV: z.enum(['development', 'preview', 'production']),
  EXPO_PUBLIC_SUPABASE_URL: z.url({ error: 'EXPO_PUBLIC_SUPABASE_URL must be a valid URL' }),
  // The anon / publishable key is PUBLIC by design (RLS is the real boundary).
  // It must NOT be a service_role / secret key — that would bypass RLS. Guard
  // against the most common catastrophic mistake (shipping the secret key).
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(20, 'EXPO_PUBLIC_SUPABASE_ANON_KEY is required')
    .refine((v) => !v.includes('service_role') && !v.startsWith('sb_secret_'), {
      error:
        'That looks like a SERVICE ROLE / secret key — never ship it in the app. Use the anon/publishable key; the service key bypasses RLS.',
    }),
  // Connexion Google — identifiants OAuth de la Google Cloud Console. Ils sont PUBLICS par nature
  // (ils figurent dans l'app et dans les URL d'autorisation) : le secret du client, lui, ne vit
  // que dans le tableau de bord Supabase. Vides = Google n'est pas encore branché.
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: GoogleClientId,
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: GoogleClientId,
  // Connexion par numéro de téléphone : « off » la masque tant que le fournisseur « Phone » n'est pas
  // activé côté Supabase (le numéro s'associe sans SMS : ADR-0010).
  EXPO_PUBLIC_AUTH_PHONE: z.enum(['on', 'off']),
});

export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(raw: Record<string, string | undefined>): Env {
  const result = EnvSchema.safeParse({
    EXPO_PUBLIC_API_URL: raw.EXPO_PUBLIC_API_URL ?? 'https://api.example.com',
    EXPO_PUBLIC_APP_ENV: raw.EXPO_PUBLIC_APP_ENV ?? 'development',
    EXPO_PUBLIC_SUPABASE_URL: raw.EXPO_PUBLIC_SUPABASE_URL ?? 'https://localhost.supabase.co',
    EXPO_PUBLIC_SUPABASE_ANON_KEY:
      raw.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'public-anon-key-placeholder',
    EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: raw.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
    EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: raw.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
    EXPO_PUBLIC_AUTH_PHONE: raw.EXPO_PUBLIC_AUTH_PHONE ?? 'on',
  });

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  • ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}\nSee .env.example`);
  }

  return result.data;
}

// Chaque variable EN TOUTES LETTRES : dans une build de production (APK, mise à jour EAS), Expo ne
// remplace que `process.env.EXPO_PUBLIC_X` écrit ainsi. `process.env` passé d'un bloc y est VIDE —
// l'app tournait alors en démonstration, sans Supabase ni Google (le test `env.test.ts` y veille).
export const env: Env = parseEnv({
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  EXPO_PUBLIC_AUTH_PHONE: process.env.EXPO_PUBLIC_AUTH_PHONE,
});

/**
 * Les valeurs de repli du schéma ci-dessus. Un `.env` qui ne définit pas
 * Supabase les laisse en place, et l'app tente alors de joindre un hôte qui
 * n'existe pas : `UnknownHostException` à la première connexion.
 */
const PLACEHOLDER_URL = 'https://localhost.supabase.co';
const PLACEHOLDER_KEY = 'public-anon-key-placeholder';

/**
 * Y a-t-il un VRAI back-end derrière cette build ?
 *
 * Sans projet Supabase renseigné, l'inscription et la connexion ne peuvent pas
 * fonctionner — il n'y a personne au bout du fil. Plutôt que d'échouer sur une
 * erreur réseau incompréhensible, l'app bascule en mode démonstration (voir
 * `features/auth/model/store.ts`) et le DIT à l'écran.
 *
 * Renseigner `EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_ANON_KEY`
 * suffit à repasser sur le vrai serveur : aucun code à changer.
 */
export const isSupabaseConfigured: boolean =
  env.EXPO_PUBLIC_SUPABASE_URL !== PLACEHOLDER_URL &&
  env.EXPO_PUBLIC_SUPABASE_ANON_KEY !== PLACEHOLDER_KEY;

/**
 * Google est-il branché ? Il faut au moins l'identifiant client « web » : c'est lui que Supabase
 * attend comme destinataire (`aud`) du jeton. Sans lui, le bouton « Continuer avec Google » n'existe
 * pas (hors démonstration) plutôt que d'échouer au toucher.
 */
export const isGoogleConfigured: boolean = env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID !== '';

/** La connexion par numéro de téléphone est-elle proposée ? (voir `EXPO_PUBLIC_AUTH_PHONE`). */
export const isPhoneAuthEnabled: boolean = env.EXPO_PUBLIC_AUTH_PHONE === 'on';

/**
 * Cette build est-elle une DÉMONSTRATION ? Vrai partout sauf en production.
 *
 * Tout ce qui sert à montrer l'app au client (missions d'exemple, vitrine d'exemple, boutons
 * « simuler la validation ») passe par ce drapeau, posé par les ROUTES : une build de production n'en
 * montre aucun, et un vrai commerçant ne peut pas valider par erreur un IBAN d'exemple. Le bouton
 * « Démo » et l'inscription pré-remplie demandent EN PLUS l'absence de serveur : voir
 * `offersDemoShortcuts`.
 */
export const isDemoBuild: boolean = env.EXPO_PUBLIC_APP_ENV !== 'production';

/**
 * Les RACCOURCIS de démonstration — le bouton « Démo » du choix du profil et l'inscription
 * pré-remplie — ne s'offrent que SANS vrai serveur. Avec Supabase branché, « Démo » ouvrait un faux
 * compte local au milieu des vrais (sans Google, droit aux centres d'intérêt), et l'inscription
 * pré-remplie créait `demo@tklink.fr` sur le serveur (26/10/2026). Le reste de la démonstration
 * (exemples, vitrine) reste régi par `isDemoBuild`.
 */
export function offersDemoShortcuts(state: {
  demoBuild: boolean;
  serverConfigured: boolean;
}): boolean {
  return state.demoBuild && !state.serverConfigured;
}

export const isDemoShortcutAvailable: boolean = offersDemoShortcuts({
  demoBuild: isDemoBuild,
  serverConfigured: isSupabaseConfigured,
});
