import { Platform } from 'react-native';
import { z } from 'zod';

import { ROLES, type Role } from '@/shared/lib/roles';
import { forgetStoredSession, supabase } from '@/shared/lib/supabase';

import { classifyAuthError, type AuthErrorCode, type AuthErrorInput } from './auth-errors';
import type { Identifier } from './identifier';
import type { SocialIdentity, SocialProvider } from './social/types';

/**
 * LE SERVICE D'AUTHENTIFICATION — chaque appel à Supabase, et rien d'autre.
 *
 * Aucune règle d'écran ici, aucun mode démonstration : ce fichier est la frontière avec le serveur.
 * Chaque fonction renvoie un résultat typé (`{ ok: true, … }` ou `{ ok: false, code }`) au lieu de
 * lever : un échec d'authentification est un cas NORMAL (mauvais mot de passe, code expiré, réseau
 * coupé), pas une exception. Le `code` est une catégorie stable (voir `auth-errors.ts`) ; le message
 * brut du serveur n'en sort jamais.
 *
 * Les appels réseau sont enveloppés dans un `try` : `supabase-js` renvoie presque toujours l'erreur,
 * mais une coupure franche peut quand même la lever.
 */
export type Failure = { ok: false; code: AuthErrorCode };
export type Done<T extends object = object> = { ok: true } & T;
export type Outcome<T extends object = object> = Done<T> | Failure;

const fail = (error: unknown): Failure => ({
  ok: false,
  code: classifyAuthError(error as AuthErrorInput),
});

/** Ce que l'inscription apprend de la personne — recopié dans son profil par un déclencheur SQL. */
export type SignUpMeta = {
  firstName: string;
  lastName: string;
  /** E.164, ou vide. Associé au compte juste après l'inscription (`linkPhone`), sans code. */
  phone: string;
  accountType: Role;
};

/** Les métadonnées d'inscription, sans les champs vides. Le déclencheur SQL valide chaque valeur. */
function metadata(meta: SignUpMeta | undefined): Record<string, string> {
  if (!meta) return {};
  const data: Record<string, string> = { account_type: meta.accountType };
  if (meta.firstName) data.first_name = meta.firstName;
  if (meta.lastName) data.last_name = meta.lastName;
  if (meta.phone) data.contact_phone = meta.phone;
  return data;
}

/* ───────────────────────────────────────────────────────────── mot de passe */

/**
 * E-mail ou téléphone + mot de passe. Par téléphone, Supabase exige que le fournisseur « Phone »
 * soit activé et que le numéro soit confirmé — c'est ce que fait `linkPhone` (sans code, pour
 * l'instant : la vérification par SMS viendra avec Prelude).
 */
export async function signInWithPassword(id: Identifier, password: string): Promise<Outcome> {
  try {
    const { error } = await supabase.auth.signInWithPassword(
      id.kind === 'email' ? { email: id.value, password } : { phone: id.value, password },
    );
    return error ? fail(error) : { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Crée le compte par e-mail. `needsCode` : le projet exige la confirmation de l'adresse — aucune
 * session n'existe encore, et un code à six chiffres vient d'être envoyé (par Resend).
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  meta?: SignUpMeta,
): Promise<Outcome<{ needsCode: boolean }>> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata(meta) },
    });
    if (error) return fail(error);
    // Adresse déjà inscrite ET confirmée : Supabase répond sans erreur, avec un utilisateur « fantôme »
    // sans identité, pour ne pas révéler l'existence d'un compte à un inconnu. L'app, elle, a une
    // vraie personne en face qui veut le savoir : on le lui dit.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return { ok: false, code: 'user_exists' };
    }
    return { ok: true, needsCode: !data.session };
  } catch (error) {
    return fail(error);
  }
}

/** Confirme l'adresse e-mail avec le code reçu : ouvre la session. */
export async function confirmSignUp(email: string, code: string): Promise<Outcome> {
  try {
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'signup' });
    return error ? fail(error) : { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function resendSignUpCode(email: string): Promise<Outcome> {
  try {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    return error ? fail(error) : { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/* ─────────────────────────────────────────────────── numéro de téléphone */

/** Ce qu'une fonction Edge renvoie dans le corps d'un refus : `{ "error": "phone_exists" }`. */
async function functionErrorCode(error: unknown): Promise<string | null> {
  const context = (error as { context?: unknown } | null)?.context as
    { clone?: () => { json: () => Promise<unknown> }; json?: () => Promise<unknown> } | undefined;
  if (!context) return null;
  try {
    const body = (await (context.clone ? context.clone().json() : context.json?.())) as
      { error?: unknown } | undefined;
    return typeof body?.error === 'string' ? body.error : null;
  } catch {
    return null;
  }
}

/** Le statut HTTP d'un refus de fonction Edge (la réponse est dans `error.context`), s'il y en a un. */
function functionStatus(error: unknown): number | null {
  const status = ((error as { context?: unknown } | null)?.context as { status?: unknown } | null)
    ?.status;
  return typeof status === 'number' ? status : null;
}

/**
 * Associe un numéro au compte connecté — SANS code, pour l'instant (décision du 24/10/2026 ; la
 * vérification par SMS viendra avec Prelude). C'est la fonction Edge `link-phone` qui le fait, avec
 * les droits du serveur : le client ne peut pas confirmer un numéro tout seul.
 *
 * Une fois associé, le numéro sert à se connecter (avec le même mot de passe). La session est
 * rafraîchie pour que l'app voie tout de suite le numéro sur le compte.
 */
export async function linkPhone(phone: string): Promise<Outcome> {
  try {
    const { error } = await supabase.functions.invoke('link-phone', {
      method: 'POST',
      body: { phone },
    });
    if (error) {
      const code = await functionErrorCode(error);
      if (code === 'phone_exists') return { ok: false, code: 'phone_taken' };
      if (code === 'phone_locked') return { ok: false, code: 'phone_locked' };
      if (code === 'invalid_phone') return { ok: false, code: 'invalid_input' };
      if (code === 'email_not_confirmed') return { ok: false, code: 'email_not_confirmed' };
      // Cinq numéros différents par 24 heures : au-delà, on n'en teste plus (voir la fonction Edge).
      if (code === 'too_many_attempts') return { ok: false, code: 'rate_limited' };
      // Jeton refusé — par la fonction, ou avant elle par la passerelle de Supabase (qui répond
      // dans son propre format) : session révoquée, compte supprimé ailleurs… il faut se reconnecter.
      if (code === 'unauthorized' || functionStatus(error) === 401) {
        return { ok: false, code: 'session_missing' };
      }
      return fail(error);
    }
    await supabase.auth.refreshSession().catch(() => undefined);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Range le numéro saisi à l'inscription par Google ou Apple dans les métadonnées du compte (un
 * CONTACT, comme celui de l'inscription par e-mail) — aucun SMS ne part. S'il ne peut pas être associé
 * tout de suite, il le sera à la connexion suivante, ou depuis « Mon compte ».
 */
export async function saveContactPhone(phone: string): Promise<Outcome> {
  try {
    const { error } = await supabase.auth.updateUser({ data: { contact_phone: phone } });
    return error ? fail(error) : { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/* ─────────────────────────────────────────────────── mot de passe oublié */

/**
 * Envoie un code de réinitialisation à une adresse e-mail. Toujours « ok » pour une adresse inconnue
 * (Supabase ne dit rien, volontairement) : on ne révèle pas quelles adresses ont un compte. Par SMS,
 * pas encore : il faudra Prelude.
 */
export async function requestPasswordReset(email: string): Promise<Outcome> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return error ? fail(error) : { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** Vérifie le code : ouvre une session (c'est elle qui autorise à changer le mot de passe). */
export async function verifyPasswordReset(email: string, code: string): Promise<Outcome> {
  try {
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' });
    return error ? fail(error) : { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function setPassword(password: string): Promise<Outcome> {
  try {
    const { error } = await supabase.auth.updateUser({ password });
    return error ? fail(error) : { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/* ───────────────────────────────────────────────────── le profil serveur */

/**
 * Ce que le serveur sait de la personne : utile sur un nouvel appareil, où rien n'est en local.
 * `accountTypeDeclared` : faux pour un compte créé par Google ou Apple dont le type n'a pas encore
 * été déclaré (`declareAccountType`) — `accountType` n'y vaut alors que la valeur par défaut.
 */
export type ServerProfile = {
  firstName: string;
  lastName: string;
  accountType: Role;
  accountTypeDeclared: boolean;
  /** L'accueil (centres d'intérêt, dossier pro ou livreur) a déjà été fait par ce compte. */
  onboarded: boolean;
  /** Les centres d'intérêt choisis à l'accueil (identifiants de catégories). */
  interests: string[];
};

const ProfileRowSchema = z.object({
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  account_type: z.enum(ROLES),
  account_type_declared: z.boolean(),
  // Migration 0009 : absentes tant qu'elle n'est pas appliquée — on lit alors « pas encore fait ».
  onboarded_at: z.string().nullable().optional(),
  interests: z.array(z.string().max(40)).max(20).nullable().optional(),
});

/**
 * Relit le profil de la personne connectée (RLS : elle ne voit que le sien). `profile: null` : pas
 * de ligne, ou une ligne illisible — l'app garde alors ce qu'elle a en local.
 */
export async function fetchMyProfile(
  userId: string,
): Promise<Outcome<{ profile: ServerProfile | null }>> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      // `*` plutôt qu'une liste : une colonne pas encore créée (migration en retard) ne fait pas
      // échouer toute la lecture — le type de compte reste lisible.
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) return fail(error);
    const parsed = ProfileRowSchema.safeParse(data);
    if (!parsed.success) return { ok: true, profile: null };
    return {
      ok: true,
      profile: {
        firstName: parsed.data.first_name ?? '',
        lastName: parsed.data.last_name ?? '',
        accountType: parsed.data.account_type,
        accountTypeDeclared: parsed.data.account_type_declared,
        onboarded: Boolean(parsed.data.onboarded_at),
        interests: parsed.data.interests ?? [],
      },
    };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Retient sur le COMPTE que l'accueil est fait, avec les centres d'intérêt choisis (migration 0009) :
 * une connexion suivante — après une déconnexion, sur un autre appareil — entre directement dans
 * l'app. RLS : la personne n'écrit que sa propre ligne, et seulement ces colonnes-là.
 */
export async function saveOnboarding(userId: string, interests: string[]): Promise<Outcome> {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ interests, onboarded_at: new Date().toISOString() })
      .eq('id', userId);
    return error ? fail(error) : { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Déclare le type de compte — une seule fois, côté serveur (`declare_account_type`, migration 0008).
 * Sert aux comptes créés par Google ou Apple, qui ne transmettent pas nos métadonnées. Renvoie le
 * type EFFECTIF : celui-ci, ou celui déjà déclaré (une seconde déclaration est ignorée).
 */
export async function declareAccountType(type: Role): Promise<Outcome<{ accountType: Role }>> {
  try {
    const { data, error } = await supabase.rpc('declare_account_type', { p_type: type });
    if (error) return fail(error);
    const parsed = z.enum(ROLES).safeParse(data);
    return parsed.success ? { ok: true, accountType: parsed.data } : { ok: false, code: 'unknown' };
  } catch (error) {
    return fail(error);
  }
}

/* ───────────────────────────────────────────────────── Google et Apple */

/** « Nouveau » : le compte vient d'être créé par cette connexion (quelques secondes à peine). */
const NEW_USER_WINDOW_MS = 2 * 60 * 1000;

const isRecent = (createdAt: string | undefined): boolean => {
  const age = Date.now() - Date.parse(createdAt ?? '');
  return Number.isFinite(age) && age < NEW_USER_WINDOW_MS;
};

/**
 * Remet le jeton d'identité du fournisseur à Supabase, qui en vérifie la signature, le destinataire
 * (`aud`) et le nonce, puis ouvre la session — en créant le compte au besoin.
 */
export async function signInWithIdToken(
  provider: SocialProvider,
  identity: SocialIdentity,
): Promise<Outcome<{ isNewUser: boolean; userId: string }>> {
  try {
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider,
      token: identity.idToken,
      ...(identity.nonce ? { nonce: identity.nonce } : {}),
    });
    if (error || !data.user) return fail(error);
    return { ok: true, isNewUser: isRecent(data.user.created_at), userId: data.user.id };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Le retour de la page Apple dans l'app. Un lien d'app (pas un lien web) : l'échange du code est
 * protégé par PKCE — un code intercepté ne sert à rien sans le vérificateur, resté sur l'appareil.
 */
export const APPLE_WEB_REDIRECT = 'tklink://auth/callback';

type WebBrowserModule = typeof import('expo-web-browser');

/**
 * APPLE SUR ANDROID — Apple n'a pas de fenêtre native sur Android : on passe par sa page de connexion,
 * dans un onglet du navigateur du système (jamais une vue web intégrée), avec PKCE.
 *
 * 1. Supabase fabrique l'adresse de la page Apple (sans l'ouvrir).
 * 2. L'onglet s'ouvre ; Apple renvoie vers Supabase, qui renvoie vers `tklink://auth/callback?code=…`.
 * 3. L'app échange le code contre une session.
 *
 * Exige côté Apple un « Services ID » et sa clé secrète, déclarés dans Supabase (voir la doc).
 */
export async function signInWithAppleWeb(): Promise<
  Outcome<{ isNewUser: boolean; userId: string; email: string }>
> {
  if (Platform.OS === 'web') return { ok: false, code: 'unavailable' };
  let browser: WebBrowserModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- why: module natif, chargé à la demande
    browser = require('expo-web-browser') as WebBrowserModule;
  } catch {
    return { ok: false, code: 'unavailable' };
  }

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: APPLE_WEB_REDIRECT, skipBrowserRedirect: true },
    });
    if (error || !data?.url) return fail(error);

    // Onglet fermé (« dismiss ») ou jamais ouvert (« cancel ») : la personne a renoncé.
    const result = await browser.openAuthSessionAsync(data.url, APPLE_WEB_REDIRECT);
    if (result.type !== 'success') return { ok: false, code: 'cancelled' };

    // Le lien de retour porte le code (ou l'erreur) dans sa requête ; Supabase recopie l'erreur dans
    // le fragment. On ne le journalise JAMAIS : il porte le code d'autorisation.
    const callback = new URL(result.url);
    const fragment = new URLSearchParams(callback.hash.replace(/^#/, ''));
    const read = (key: string) => callback.searchParams.get(key) ?? fragment.get(key);
    const returnedError = read('error');
    if (returnedError) {
      // `user_cancelled_authorize` : la personne a fermé la page d'Apple. `access_denied`, lui, n'est
      // PAS une annulation (inscriptions fermées, compte suspendu…) : on le classe par son code.
      if (returnedError === 'user_cancelled_authorize') return { ok: false, code: 'cancelled' };
      return fail({ code: read('error_code') ?? returnedError });
    }
    const code = callback.searchParams.get('code');
    if (!code) return { ok: false, code: 'unknown' };

    const exchange = await supabase.auth.exchangeCodeForSession(code);
    if (exchange.error || !exchange.data.user) return fail(exchange.error);
    const user = exchange.data.user;
    return {
      ok: true,
      isNewUser: isRecent(user.created_at),
      userId: user.id,
      email: user.email ?? '',
    };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Range le nom donné par Apple (une seule fois !) dans le profil. Un échec ici n'empêche pas la
 * connexion : on le laisse passer en silence, le nom pourra être saisi plus tard.
 */
export async function rememberName(
  userId: string,
  name: { firstName: string; lastName: string },
): Promise<void> {
  const first = name.firstName.trim();
  const last = name.lastName.trim();
  if (!first && !last) return;
  try {
    await supabase
      .from('profiles')
      .update({
        ...(first ? { first_name: first } : {}),
        ...(last ? { last_name: last } : {}),
        display_name: [first, last].filter(Boolean).join(' '),
      })
      .eq('id', userId);
  } catch {
    // Voir ci-dessus : le nom n'est pas indispensable à la connexion.
  }
}

/* ───────────────────────────────────────────────────────────────── session */

/** Ferme la session de CET appareil seulement (« global » déconnecterait tous les autres). */
/** Au-delà, on n'attend plus le serveur : la session locale est effacée quand même. */
const SIGN_OUT_TIMEOUT_MS = 5000;

/**
 * Ferme la session de CET appareil seulement (« global » déconnecterait tous les autres).
 *
 * Hors ligne avec un jeton expiré, supabase-js réessaie de le renouveler (jusqu'à ~25 s) puis rend
 * une erreur SANS effacer la session : on n'attend pas plus de 5 s, et on l'efface nous-mêmes —
 * sinon la personne se retrouverait connectée au lancement suivant.
 */
export async function signOut(): Promise<void> {
  let closed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), SIGN_OUT_TIMEOUT_MS);
    });
    const result = await Promise.race([supabase.auth.signOut({ scope: 'local' }), timeout]);
    closed = result !== null && !result.error;
  } catch {
    closed = false;
  } finally {
    clearTimeout(timer);
  }
  if (!closed) await forgetStoredSession();
}

/** Supprime le compte et toutes ses données (fonction Edge `delete-account`, JWT vérifié). */
export async function deleteAccount(): Promise<Outcome> {
  try {
    const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
    if (!error) return { ok: true };
    // Jeton refusé (session révoquée ou expirée) : réessayer ne servirait à rien, il faut se reconnecter.
    if (functionStatus(error) === 401) return { ok: false, code: 'session_missing' };
    return fail(error);
  } catch (error) {
    return fail(error);
  }
}
