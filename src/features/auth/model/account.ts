import type { Session } from '@supabase/supabase-js';

/**
 * CE QUE LA SESSION DIT DU COMPTE — lu par l'écran « Mon compte ».
 *
 * Deux numéros peuvent coexister, et il ne faut pas les confondre :
 *  - `user.phone` : le numéro CONFIRMÉ par SMS (Supabase l'écrit sans « + »). C'est une identité de
 *    connexion.
 *  - `user_metadata.contact_phone` : le numéro SAISI à l'inscription, pas encore vérifié. Un contact,
 *    pas une identité : on ne peut pas se connecter avec.
 */
export type AccountProvider = 'email' | 'phone' | 'google' | 'apple' | 'demo';

export type AccountInfo = {
  email: string | null;
  /** E.164, avec le « + ». */
  phone: string | null;
  /** Le numéro est-il confirmé par SMS — donc utilisable pour se connecter ? */
  phoneVerified: boolean;
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

  const confirmed = Boolean(user.phone) && Boolean(user.phone_confirmed_at);
  const contact = typeof meta.contact_phone === 'string' ? meta.contact_phone : '';
  const phone = user.phone ? plus(user.phone) : contact || null;

  // Un compte de démonstration n'a pas de serveur pour confirmer quoi que ce soit : son numéro est
  // « vérifié » dès qu'il a servi d'identifiant, ou après le code de démonstration.
  const phoneVerified = provider === 'demo' ? Boolean(user.phone) : confirmed;

  const first = meta.first_name ?? meta.given_name ?? '';
  return {
    email: user.email ?? null,
    phone,
    phoneVerified,
    provider,
    firstName: typeof first === 'string' ? first : '',
  };
}
