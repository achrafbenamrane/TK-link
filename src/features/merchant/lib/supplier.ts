import { isValidSiret } from '@/shared/lib/roles';

/**
 * LE DOSSIER DU FOURNISSEUR — étapes 3 à 6 du « Process grossiste / fournisseur » du client :
 *
 *   3. Dépôt des informations pro (SIRET, identité, adresse, coordonnées bancaires)
 *   4. Vérification du profil — contrôle par TK LINK
 *   5. Sécurisation (appareil enregistré + authentification locale)
 *   6. Compte validé → accès au tableau de bord fournisseur
 *
 * Un grossiste non validé ne publie pas d'offre : ses lots seraient visibles de commerçants
 * qui ne savent pas encore s'il est ce qu'il dit être.
 */
/**
 * Les deux profils professionnels qui passent par ce dossier : les cartes « Process
 * commerçant » et « Process grossiste / fournisseur » ont les mêmes étapes 3 à 6 ; seuls les
 * mots changent.
 */
export type ProRole = 'commercant' | 'grossiste';

export const PRO_COPY: Record<
  ProRole,
  { account: string; entity: string; dashboard: string; publish: string; locked: string }
> = {
  commercant: {
    account: 'commerçant',
    entity: 'commerce',
    dashboard: 'tableau de bord commerçant',
    publish: 'la publication de vos Flash',
    locked:
      'Déposez vos informations pro pour que TK LINK vérifie votre commerce : la publication de Flash s’ouvre ensuite.',
  },
  grossiste: {
    account: 'fournisseur',
    entity: 'entreprise',
    dashboard: 'tableau de bord fournisseur',
    publish: 'la publication d’offres pro',
    locked:
      'Déposez vos informations pro pour que TK LINK vérifie votre entreprise : la publication d’offres s’ouvre ensuite.',
  },
};

export const SUPPLIER_STATUSES = ['brouillon', 'en_verification', 'valide'] as const;
export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number];

export type SupplierDraft = {
  siret: string;
  address: string;
  iban: string;
  idUri: string;
};

/** Retire les espaces et passe en majuscules : « fr76 3000 … » et « FR763000… » sont le même IBAN. */
export function normalizeIban(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase();
}

/**
 * Un repère affichable : le pays, la clé et les quatre derniers caractères (« FR76 •••• 9189 »).
 * C'est tout ce que le magasin d'état garde ; l'IBAN entier va dans le coffre sécurisé.
 */
export function maskIban(raw: string): string {
  const iban = normalizeIban(raw);
  if (iban.length < 8) return '';
  return `${iban.slice(0, 4)} •••• ${iban.slice(-4)}`;
}

/** Regroupe par quatre, comme sur un RIB. */
export function formatIban(raw: string): string {
  return normalizeIban(raw)
    .replace(/(.{4})/g, '$1 ')
    .trim();
}

/**
 * Un IBAN est valide quand sa clé (ISO 7064, modulo 97) tombe juste. Vérifier la clé
 * plutôt que la seule longueur attrape la faute de frappe avant l'envoi du dossier.
 */
export function isValidIban(raw: string): boolean {
  const iban = normalizeIban(raw);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const moved = iban.slice(4) + iban.slice(0, 4);
  let rest = 0;
  for (const ch of moved) {
    const code = ch >= 'A' && ch <= 'Z' ? String(ch.charCodeAt(0) - 55) : ch;
    for (const digit of code) rest = (rest * 10 + Number(digit)) % 97;
  }
  return rest === 1;
}

/** Ce qui manque au dossier, champ par champ. Vide = prêt à partir en vérification. */
export function missingSupplierFields(draft: SupplierDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!isValidSiret(draft.siret)) errors.siret = 'Saisissez un SIRET valide (14 chiffres)';
  if (draft.address.trim().length < 5) errors.address = 'Indiquez l’adresse de l’entreprise';
  if (!isValidIban(draft.iban)) errors.iban = 'Cet IBAN n’est pas valide';
  if (!draft.idUri) errors.idUri = 'Ajoutez la pièce d’identité du dirigeant';
  return errors;
}

/** Le grossiste peut-il publier ? Seulement une fois son compte validé. */
export function canSupplierPublish(status: SupplierStatus): boolean {
  return status === 'valide';
}
