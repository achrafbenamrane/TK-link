/**
 * Traduction des erreurs d'authentification.
 *
 * Supabase renvoie des messages techniques en anglais (« Invalid login
 * credentials », « AuthRetryableFetchError »). Les afficher tels quels, c'est
 * deux fautes en une : la langue, et le fait d'exposer la plomberie à
 * l'utilisateur.
 *
 * Règle de sécurité au passage : sur un échec de connexion, on ne dit JAMAIS si
 * c'est l'adresse ou le mot de passe qui cloche. Distinguer les deux permet de
 * tester si une adresse possède un compte — c'est de l'énumération de comptes.
 */
const KNOWN: { match: RegExp; message: string }[] = [
  {
    match: /invalid login credentials|invalid credentials/i,
    message: 'Adresse e-mail ou mot de passe incorrect.',
  },
  {
    match: /email not confirmed/i,
    message: 'Confirmez votre adresse e-mail avant de vous connecter — vérifiez vos courriels.',
  },
  {
    match: /user already registered|already been registered/i,
    message: 'Un compte existe déjà avec cette adresse. Connectez-vous.',
  },
  {
    match: /password.*(at least|should be)/i,
    message: 'Mot de passe trop court : 8 caractères minimum.',
  },
  {
    match: /rate limit|too many requests/i,
    message: 'Trop de tentatives. Patientez une minute avant de réessayer.',
  },
  {
    match: /fetch|network|timeout/i,
    message: 'Connexion impossible. Vérifiez votre réseau et réessayez.',
  },
];

/** Message affichable, en français. Jamais l'erreur brute du fournisseur. */
export function friendlyAuthError(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const hit = KNOWN.find((k) => k.match.test(raw));
  // Défaut volontairement vague : une erreur inconnue ne doit pas déverser un
  // message serveur dans l'interface.
  return hit ? hit.message : 'Connexion impossible pour le moment. Réessayez.';
}
