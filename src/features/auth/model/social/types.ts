/**
 * CONNEXION SOCIALE — ce qu'un fournisseur (Google, Apple) rend à l'app.
 *
 * Le flux est le même pour les deux : le téléphone ouvre la fenêtre NATIVE du fournisseur (pas un
 * navigateur intégré, pas de redirection, donc rien à intercepter), récupère un jeton d'identité
 * signé (« ID token »), et l'app le remet à Supabase, qui en vérifie la signature et ouvre la
 * session. L'app ne voit jamais le mot de passe Google ou Apple de la personne.
 */
export type SocialProvider = 'google' | 'apple';

export type SocialIdentity = {
  /** Le jeton d'identité, signé par le fournisseur. À remettre tel quel à Supabase, jamais journalisé. */
  idToken: string;
  /**
   * Apple seulement : le nonce NON haché. Apple reçoit son empreinte, Supabase le nonce brut, et
   * compare l'une à l'autre — c'est ce qui rend un jeton volé inutilisable ailleurs.
   */
  nonce?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
};

/**
 * - `cancelled` : la personne a fermé la fenêtre — pas une erreur, on n'affiche rien.
 * - `unavailable` : ce fournisseur n'est pas utilisable ici (build sans la configuration, appareil
 *   sans services Google, Apple hors iOS).
 * - `unknown` : tout le reste (réseau, jeton absent…) — message générique, jamais le détail.
 */
export type SocialFailure = 'cancelled' | 'unavailable' | 'unknown';

export type SocialResult = ({ ok: true } & SocialIdentity) | { ok: false; code: SocialFailure };
