import { z } from 'zod';

/**
 * L'IDENTIFIANT DE CONNEXION — une adresse e-mail OU un numéro de téléphone.
 *
 * Le client veut pouvoir se connecter avec l'un ou l'autre, et un mot de passe. L'écran n'a donc
 * qu'UN champ « E-mail ou téléphone » : on devine de quoi il s'agit, plutôt que de faire choisir
 * l'utilisateur entre deux onglets avant même qu'il ait tapé.
 *
 * Tout ce qui part vers le serveur est NORMALISÉ ici, une seule fois : l'e-mail en minuscules, le
 * numéro au format E.164 (« +33612345678 »), le seul que Supabase accepte. Un numéro « 06 12 34 56
 * 78 » et un numéro « +33 6 12 34 56 78 » désignent donc le même compte.
 */
export type Identifier =
  | { kind: 'email'; value: string }
  /** `value` est au format E.164. */
  | { kind: 'phone'; value: string };

/** Pourquoi une saisie est refusée — pour dire à l'utilisateur ce qui cloche, sans le deviner. */
export type IdentifierHint = 'empty' | 'email' | 'phone' | 'phone_disabled';

export type IdentifierResult =
  { ok: true; identifier: Identifier } | { ok: false; hint: IdentifierHint };

const EMAIL = z.email();

/** Ce qu'on tolère dans un numéro saisi à la main : chiffres, +, espaces, points, tirets, parenthèses. */
const PHONE_CHARS = /^[+\d\s.\-()]+$/;

/**
 * Un numéro de téléphone en E.164, ou `null` s'il n'en est pas un.
 *
 * - France d'abord : « 06 12 34 56 78 », « 06.12.34.56.78 », « 0612345678 » → « +33612345678 ».
 * - Les autres pays doivent porter leur indicatif : « +213… », « 0032… ».
 * - Le « 0 » de tête saisi après l'indicatif (« +33 (0)6 12… ») est retiré : il n'existe pas en E.164.
 */
export function normalizePhone(raw: string): string | null {
  const compact = raw.trim().replace(/[\s.\-()]/g, '');
  if (compact === '') return null;

  let digits: string;
  if (compact.startsWith('+')) digits = compact.slice(1);
  else if (compact.startsWith('00')) digits = compact.slice(2);
  else if (/^0[1-9]\d{8}$/.test(compact)) return `+33${compact.slice(1)}`;
  else return null;

  // « +33 (0)6… » → « +336… ».
  if (/^330[1-9]\d{8}$/.test(digits)) digits = `33${digits.slice(3)}`;

  // E.164 : 8 à 15 chiffres, sans zéro de tête.
  if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
  // La France a un plan de numérotation précis : 9 chiffres après l'indicatif, jamais « 0 ».
  if (digits.startsWith('33') && !/^33[1-9]\d{8}$/.test(digits)) return null;

  return `+${digits}`;
}

/**
 * Devine et normalise ce que l'utilisateur a tapé.
 *
 * `allowPhone: false` quand la connexion par téléphone n'est pas proposée (aucun fournisseur de SMS
 * branché) : un numéro est alors refusé avec un message qui le dit, au lieu d'échouer au serveur.
 */
export function parseIdentifier(
  raw: string,
  options: { allowPhone?: boolean } = {},
): IdentifierResult {
  const { allowPhone = true } = options;
  const value = raw.trim();
  if (value === '') return { ok: false, hint: 'empty' };

  if (value.includes('@')) {
    const email = value.toLowerCase();
    return EMAIL.safeParse(email).success
      ? { ok: true, identifier: { kind: 'email', value: email } }
      : { ok: false, hint: 'email' };
  }

  if (PHONE_CHARS.test(value)) {
    if (!allowPhone) return { ok: false, hint: 'phone_disabled' };
    const phone = normalizePhone(value);
    return phone
      ? { ok: true, identifier: { kind: 'phone', value: phone } }
      : { ok: false, hint: 'phone' };
  }

  // Ni « @ » ni chiffres : le plus probable est une adresse e-mail incomplète.
  return { ok: false, hint: 'email' };
}

/** Le message sous le champ, en français. */
export const IDENTIFIER_MESSAGE: Record<IdentifierHint, string> = {
  empty: 'Entrez votre e-mail ou votre numéro de téléphone.',
  email: 'Entrez une adresse e-mail valide.',
  phone: 'Numéro invalide (ex. 06 12 34 56 78 ou +213 5 55 12 34 56).',
  phone_disabled:
    'La connexion par numéro de téléphone n’est pas encore disponible. Utilisez votre e-mail.',
};

/** « n•••@exemple.fr » — assez pour se reconnaître, pas assez pour être lu par-dessus l'épaule. */
export function maskEmail(email: string): string {
  const [name = '', domain = ''] = email.split('@');
  return `${name.slice(0, 1)}•••@${domain}`;
}

/** « +33 ••• •• •• 78 » : l'indicatif et les deux derniers chiffres. */
export function maskPhone(e164: string): string {
  return `${e164.slice(0, 3)} ••• •• •• ${e164.slice(-2)}`;
}

export function maskIdentifier(identifier: Identifier): string {
  return identifier.kind === 'email' ? maskEmail(identifier.value) : maskPhone(identifier.value);
}

/** « +33612345678 » → « 06 12 34 56 78 » ; les autres pays restent en E.164. */
export function displayPhone(e164: string): string {
  const m = /^\+33([1-9])(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(e164);
  return m ? `0${m[1]} ${m[2]} ${m[3]} ${m[4]} ${m[5]}` : e164;
}
