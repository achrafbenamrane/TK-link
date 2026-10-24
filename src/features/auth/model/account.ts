import type { Session } from '@supabase/supabase-js';

/**
 * CE QUE LA SESSION DIT DU COMPTE — lu par l'écran « Mon compte ».
 *
 * Deux numéros peuvent coexister, et il ne faut pas les confondre :
 *  - `user.phone` : le numéro ASSOCIÉ au compte (Supabase l'écrit sans « + »). C'est une identité de
 *    connexion : on peut se connecter avec lui et son mot de passe.
 *  - `user_metadata.contact_phone` : le numéro SAISI à l'inscription, pas encore associé (il le sera
 *    à la première connexion). Un contact, pas une identité.
 *
 * Aucun des deux n'est « vérifié » par SMS aujourd'hui (décision du 24/10/2026) : la vérification
 * viendra avec Prelude, et se lira alors dans le profil serveur (`profiles.phone_verified`).
 */
export type AccountProvider = 'email' | 'phone' | 'google' | 'apple' | 'demo';

export type AccountInfo = {
  email: string | null;
  /** E.164, avec le « + ». */
  phone: string | null;
  /** Le numéro est-il associé au compte — donc utilisable pour se connecter ? */
  phoneLinked: boolean;
  provider: AccountProvider;
  firstName: string;
};

const PROVIDERS: readonly AccountProvider[] = ['email', 'phone', 'google', 'apple', 'demo'];

const plus = (digits: string): string => (digits.startsWith('+') ? digits : `+${digits}`);

export function describeAccount(session: Session | null): AccountInfo | null {
  const user = session?.user;
  if (!user) return null;

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const rawProvider = (user.app_metadata as { provider?: string } | undefined)?.provider ?? 'email';
  const provider = PROVIDERS.find((p) => p === rawProvider) ?? 'email';

  const contact = typeof meta.contact_phone === 'string' ? meta.contact_phone : '';
  const phone = user.phone ? plus(user.phone) : contact || null;
  // Supabase n'accepte une connexion par numéro que s'il est marqué confirmé sur le compte.
  const phoneLinked = Boolean(user.phone) && Boolean(user.phone_confirmed_at);

  const first = meta.first_name ?? meta.given_name ?? '';
  return {
    email: user.email ?? null,
    phone,
    phoneLinked,
    provider,
    firstName: typeof first === 'string' ? first : '',
  };
}
