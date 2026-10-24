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
  // Connexion par numéro de téléphone : « off » la masque tant qu'aucun fournisseur de SMS n'est
  // branché côté Supabase (sans lui, le code de vérification ne part jamais).
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

export const env: Env = parseEnv(process.env as Record<string, string | undefined>);

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
 * Tout ce qui sert à montrer l'app au client (inscription pré-remplie, bouton « Démo » du choix de
 * profil, missions d'exemple, vitrine d'exemple, boutons « simuler la validation ») passe par ce
 * drapeau, posé par les ROUTES : une build de production n'en montre aucun, et un vrai commerçant ne
 * peut pas valider par erreur un IBAN d'exemple.
 */
export const isDemoBuild: boolean = env.EXPO_PUBLIC_APP_ENV !== 'production';
