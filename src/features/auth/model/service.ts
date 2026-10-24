import { supabase } from '@/shared/lib/supabase';
import type { Role } from '@/shared/lib/roles';

import { classifyAuthError, type AuthErrorCode, type AuthErrorInput } from './auth-errors';
import type { Identifier } from './identifier';
import type { SocialIdentity, SocialProvider } from './social/types';

/**
 * LE SERVICE D'AUTHENTIFICATION — chaque appel à Supabase Auth, et rien d'autre.
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
  /** E.164, ou vide. Un contact, pas encore une identité : il n'est « vérifié » que par SMS. */
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
 * session n'existe encore, et un code à six chiffres vient d'être envoyé.
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

/* ───────────────────────────────────────────────────────── numéro de téléphone */

/**
 * Rattache (ou change) le numéro d'un compte déjà connecté : Supabase envoie un code par SMS. Le
 * numéro ne devient une identité de connexion qu'une fois confirmé (`confirmPhone`).
 */
export async function startPhoneVerification(phone: string): Promise<Outcome> {
  try {
    const { error } = await supabase.auth.updateUser({ phone });
    return error ? fail(error) : { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function confirmPhone(phone: string, code: string): Promise<Outcome> {
  try {
    const { error } = await supabase.auth.verifyOtp({ phone, token: code, type: 'phone_change' });
    return error ? fail(error) : { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function resendPhoneCode(phone: string): Promise<Outcome> {
  try {
    const { error } = await supabase.auth.resend({ type: 'phone_change', phone });
    return error ? fail(error) : { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/* ─────────────────────────────────────────────────── mot de passe oublié */

/**
 * Un numéro inconnu : Supabase refuse d'envoyer un code (« signups not allowed for otp ») puisqu'on
 * interdit la création de compte. Répondre autre chose que « code envoyé » dirait à n'importe qui si
 * un numéro possède un compte : on avale cette erreur-là, et seulement celle-là.
 */
function isUnknownUser(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  return (
    e?.code === 'otp_disabled' ||
    e?.code === 'user_not_found' ||
    /signups? not allowed|user not found/i.test(e?.message ?? '')
  );
}

/**
 * Envoie un code de réinitialisation. Toujours « ok » pour un identifiant inconnu : on ne révèle pas
 * quels e-mails ou numéros ont un compte. Seuls un réseau coupé ou une limite d'envoi se voient.
 */
export async function requestPasswordReset(id: Identifier): Promise<Outcome> {
  try {
    if (id.kind === 'email') {
      const { error } = await supabase.auth.resetPasswordForEmail(id.value);
      return error ? fail(error) : { ok: true };
    }
    const { error } = await supabase.auth.signInWithOtp({
      phone: id.value,
      options: { shouldCreateUser: false },
    });
    if (error && !isUnknownUser(error)) return fail(error);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** Vérifie le code : ouvre une session (c'est elle qui autorise à changer le mot de passe). */
export async function verifyPasswordReset(id: Identifier, code: string): Promise<Outcome> {
  try {
    const { error } = await supabase.auth.verifyOtp(
      id.kind === 'email'
        ? { email: id.value, token: code, type: 'recovery' }
        : { phone: id.value, token: code, type: 'sms' },
    );
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

/* ───────────────────────────────────────────────────── Google et Apple */

/** « Nouveau » : le compte vient d'être créé par cette connexion (quelques secondes à peine). */
const NEW_USER_WINDOW_MS = 2 * 60 * 1000;

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
    const age = Date.now() - Date.parse(data.user.created_at);
    return {
      ok: true,
      isNewUser: Number.isFinite(age) && age < NEW_USER_WINDOW_MS,
      userId: data.user.id,
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
export async function signOut(): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    // Hors ligne : la session locale est quand même effacée par le client.
  }
}

/** Supprime le compte et toutes ses données (fonction Edge `delete-account`, JWT vérifié). */
export async function deleteAccount(): Promise<Outcome> {
  try {
    const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
    return error ? fail(error) : { ok: true };
  } catch (error) {
    return fail(error);
  }
}
