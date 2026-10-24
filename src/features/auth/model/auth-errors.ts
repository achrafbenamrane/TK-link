/**
 * Traduction des erreurs d'authentification.
 *
 * Supabase renvoie des messages techniques en anglais (« Invalid login
 * credentials », « AuthRetryableFetchError »). Les afficher tels quels, c'est
 * deux fautes en une : la langue, et le fait d'exposer la plomberie à
 * l'utilisateur.
 *
 * On classe d'abord par CODE d'erreur (`error.code`, stable) et seulement à défaut par message
 * (libellé qui change d'une version à l'autre) : voir `classifyAuthError`.
 *
 * Règle de sécurité au passage : sur un échec de connexion, on ne dit JAMAIS si
 * c'est l'identifiant ou le mot de passe qui cloche. Distinguer les deux permet de
 * tester si une adresse ou un numéro possède un compte — c'est de l'énumération de comptes.
 */

export type AuthErrorCode =
  /** La saisie est refusée AVANT tout appel au serveur (e-mail mal formé, mot de passe trop court…). */
  | 'invalid_input'
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'phone_not_confirmed'
  | 'user_exists'
  | 'weak_password'
  | 'same_password'
  | 'rate_limited'
  | 'network'
  | 'otp_invalid'
  | 'sms_unavailable'
  | 'provider_disabled'
  | 'signup_disabled'
  | 'session_missing'
  /** L'utilisateur a fermé la fenêtre Google / Apple : ce n'est pas une erreur à lui montrer. */
  | 'cancelled'
  /** Google / Apple ne sont pas utilisables sur cet appareil ou dans cette build. */
  | 'unavailable'
  | 'unknown';

/** Ce que porte une erreur Supabase (ou n'importe quelle erreur) qui nous intéresse. */
export type AuthErrorInput =
  | { code?: string | undefined; message?: string | undefined; name?: string | undefined }
  | string
  | null
  | undefined;

/** Codes d'erreur Supabase Auth (https://supabase.com/docs/guides/auth/debugging/error-codes). */
const BY_CODE: Record<string, AuthErrorCode> = {
  invalid_credentials: 'invalid_credentials',
  // « Utilisateur introuvable » : indistinguable d'un mauvais mot de passe, volontairement.
  user_not_found: 'invalid_credentials',
  email_not_confirmed: 'email_not_confirmed',
  phone_not_confirmed: 'phone_not_confirmed',
  user_already_exists: 'user_exists',
  email_exists: 'user_exists',
  phone_exists: 'user_exists',
  identity_already_exists: 'user_exists',
  weak_password: 'weak_password',
  same_password: 'same_password',
  over_request_rate_limit: 'rate_limited',
  over_email_send_rate_limit: 'rate_limited',
  over_sms_send_rate_limit: 'rate_limited',
  // Supabase répond « expiré ou invalide » sans distinguer : un seul message pour les deux.
  otp_expired: 'otp_invalid',
  otp_disabled: 'provider_disabled',
  sms_send_failed: 'sms_unavailable',
  provider_disabled: 'provider_disabled',
  email_provider_disabled: 'provider_disabled',
  phone_provider_disabled: 'provider_disabled',
  signup_disabled: 'signup_disabled',
  session_not_found: 'session_missing',
  session_expired: 'session_missing',
  refresh_token_not_found: 'session_missing',
  refresh_token_already_used: 'session_missing',
  bad_jwt: 'session_missing',
  request_timeout: 'network',
};

/** Repli quand l'erreur n'a pas de code : le libellé, comme avant. */
const BY_MESSAGE: { match: RegExp; code: AuthErrorCode }[] = [
  { match: /invalid login credentials|invalid credentials/i, code: 'invalid_credentials' },
  { match: /email not confirmed/i, code: 'email_not_confirmed' },
  { match: /phone not confirmed/i, code: 'phone_not_confirmed' },
  { match: /user already registered|already been registered/i, code: 'user_exists' },
  { match: /password.*(at least|should be)/i, code: 'weak_password' },
  { match: /rate limit|too many requests/i, code: 'rate_limited' },
  { match: /token has expired or is invalid|otp.*(expired|invalid)/i, code: 'otp_invalid' },
  { match: /error sending .*otp|sms.*(provider|send)/i, code: 'sms_unavailable' },
  { match: /signups? not allowed/i, code: 'signup_disabled' },
  { match: /provider is not enabled|provider.*disabled/i, code: 'provider_disabled' },
  { match: /fetch|network|timeout/i, code: 'network' },
];

const MESSAGE: Record<AuthErrorCode, string | null> = {
  invalid_input: 'Vérifiez les informations saisies.',
  invalid_credentials: 'Identifiant ou mot de passe incorrect.',
  email_not_confirmed:
    'Confirmez votre adresse e-mail avant de vous connecter — vérifiez vos courriels.',
  phone_not_confirmed: 'Confirmez votre numéro de téléphone avant de vous connecter.',
  user_exists: 'Un compte existe déjà avec cet identifiant. Connectez-vous.',
  weak_password: 'Mot de passe trop court : 8 caractères minimum.',
  same_password: 'Le nouveau mot de passe doit être différent de l’ancien.',
  rate_limited: 'Trop de tentatives. Patientez une minute avant de réessayer.',
  network: 'Connexion impossible. Vérifiez votre réseau et réessayez.',
  otp_invalid: 'Code incorrect ou expiré. Demandez-en un nouveau.',
  sms_unavailable: 'L’envoi de SMS n’est pas disponible pour le moment. Utilisez votre e-mail.',
  provider_disabled: 'Cette méthode de connexion n’est pas disponible pour le moment.',
  signup_disabled: 'Les inscriptions sont fermées pour le moment.',
  session_missing: 'Votre session a expiré. Reconnectez-vous.',
  // Rien à dire : l'utilisateur a lui-même fermé la fenêtre.
  cancelled: null,
  unavailable: 'Cette méthode de connexion n’est pas disponible sur cet appareil.',
  // Défaut volontairement vague : une erreur inconnue ne doit pas déverser un
  // message serveur dans l'interface.
  unknown: 'Connexion impossible pour le moment. Réessayez.',
};

/** La catégorie d'une erreur, par code d'abord, par libellé à défaut. */
export function classifyAuthError(input: AuthErrorInput): AuthErrorCode {
  if (!input) return 'unknown';
  // Une catégorie déjà classée (celle que le store garde en état) ou un code Supabase brut.
  if (typeof input === 'string' && Object.hasOwn(MESSAGE, input)) return input as AuthErrorCode;
  if (typeof input === 'string' && Object.hasOwn(BY_CODE, input)) return BY_CODE[input]!;
  if (typeof input !== 'string') {
    if (input.code && BY_CODE[input.code]) return BY_CODE[input.code]!;
    // `AuthRetryableFetchError` : le réseau, pas le serveur.
    if (input.name === 'AuthRetryableFetchError') return 'network';
    if (input.name === 'AuthWeakPasswordError') return 'weak_password';
  }
  const text = typeof input === 'string' ? input : (input.message ?? '');
  return BY_MESSAGE.find((k) => k.match.test(text))?.code ?? 'unknown';
}

/** Le message affichable pour une catégorie (`null` : ne rien afficher). */
export function authErrorMessage(code: AuthErrorCode): string | null {
  return MESSAGE[code];
}

/** Message affichable, en français. Jamais l'erreur brute du fournisseur. */
export function friendlyAuthError(raw: AuthErrorInput): string | null {
  if (!raw) return null;
  return authErrorMessage(classifyAuthError(raw));
}
