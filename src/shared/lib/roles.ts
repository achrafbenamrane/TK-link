/**
 * Les rôles TKLINK — CDC §3, §4, §5, §20.
 *
 * Vit dans `shared` et non dans une feature parce que TROIS features en
 * dépendent (onboarding, auth, shop) et qu’une feature ne peut pas en importer
 * une autre. C’est le vocabulaire commun du produit, pas un détail d’écran.
 *
 * Le livreur (CDC §3.4) n’est pas ici : le CDC en fait une **application mobile
 * distincte**, et son intégration au MVP reste à confirmer (§23 Q5). L’ajouter
 * à cette liste laisserait croire qu’un livreur peut se connecter à l’app
 * client, ce qui est faux.
 */

export const ROLES = ['consommateur', 'commercant', 'grossiste'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  consommateur: 'Consommateur',
  commercant: 'Commerçant',
  grossiste: 'Grossiste',
};

/** Ce que le rôle vient faire ici — sert l’étape de choix à l’onboarding. */
export const ROLE_TAGLINE: Record<Role, string> = {
  consommateur: 'Je cherche les bons plans près de chez moi',
  commercant: 'Je vends en boutique et j’achète en gros',
  grossiste: 'Je propose des lots aux commerçants',
};

export const ROLE_ICON: Record<Role, string> = {
  consommateur: 'user',
  commercant: 'shopping-bag',
  grossiste: 'truck',
};

/**
 * Qui publie les offres que ce rôle consulte — CDC §3.1, §3.2 et §20.
 *
 * « Les consommateurs voient principalement les annonces proposées par les
 * commerçants. Les commerçants voient les annonces proposées par les
 * grossistes. » C’est la règle de visibilité centrale de la plateforme, et
 * c’est une chaîne, pas un graphe : chacun regarde exactement un cran
 * au-dessus.
 *
 * Le grossiste renvoie `null` : il publie, il n’achète pas sur la plateforme.
 */
export function audienceOf(role: Role): Role | null {
  if (role === 'consommateur') return 'commercant';
  if (role === 'commercant') return 'grossiste';
  return null;
}

/** Ce lecteur a-t-il le droit de voir une offre publiée par ce rôle ? */
export function canSeeOffersFrom(viewer: Role, author: Role): boolean {
  return audienceOf(viewer) === author;
}

/** Qui peut publier des offres — le consommateur, non. */
export function canPublishOffers(role: Role): boolean {
  return role === 'commercant' || role === 'grossiste';
}

/* ---- SIRET (CDC §5) ---- */

/** Ne garde que les chiffres : l’utilisateur colle souvent « 123 456 789 01234 ». */
export function normalizeSiret(raw: string): string {
  return raw.replace(/\D/g, '');
}

/** Les 9 premiers chiffres d’un SIRET sont le SIREN de l’entreprise. */
export function sirenOf(raw: string): string {
  return normalizeSiret(raw).slice(0, 9);
}

function sumDigits(digits: string): number {
  let sum = 0;
  for (const c of digits) sum += Number(c);
  return sum;
}

function luhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    // On double un chiffre sur deux en partant de la DROITE.
    const d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      const doubled = d * 2;
      sum += doubled > 9 ? doubled - 9 : doubled;
    } else {
      sum += d;
    }
  }
  return sum % 10 === 0;
}

/**
 * Un SIRET est-il structurellement valide ?
 *
 * 14 chiffres et une clé de Luhn. Vérifier la clé plutôt que la seule longueur
 * a un intérêt concret : une faute de frappe est rejetée tout de suite, à la
 * saisie, au lieu de partir en base et de bloquer une commande plus tard.
 *
 * ⚠️ Cela prouve que le numéro est bien FORMÉ, pas qu’il EXISTE. Seule une
 * vérification auprès du répertoire SIRENE le prouverait — c’est un appel
 * réseau, donc du back-end, hors de cette fonction pure.
 *
 * Exception officielle : La Poste (SIREN 356 000 000) échappe à Luhn ; sa règle
 * est que la somme des chiffres soit un multiple de 5. Sans elle, on
 * refuserait à tort chaque établissement de La Poste.
 */
export function isValidSiret(raw: string): boolean {
  const digits = normalizeSiret(raw);
  if (digits.length !== 14) return false;
  if (digits.startsWith('356000000')) return sumDigits(digits) % 5 === 0;
  return luhn(digits);
}

/** Affichage lisible : « 123 456 789 01234 ». */
export function formatSiret(raw: string): string {
  const d = normalizeSiret(raw).slice(0, 14);
  const parts = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9), d.slice(9)].filter(Boolean);
  return parts.join(' ');
}

/* ---- Commander chez un grossiste (CDC §5) ---- */

/**
 * Pourquoi cette commande grossiste est refusée — `null` si elle est permise.
 *
 * Le CDC est catégorique : « Un commerçant ne doit pas pouvoir passer une
 * commande auprès d’un grossiste sans avoir renseigné son SIRET. » On renvoie
 * le MOTIF et non un booléen, parce que « ce n’est pas votre rôle » et « il
 * manque votre SIRET » n’appellent pas du tout la même réponse à l’écran : la
 * seconde se répare en trente secondes.
 */
export type WholesaleBlock = 'role' | 'siret' | null;

export function wholesaleOrderBlock(role: Role, siret: string | null): WholesaleBlock {
  if (role !== 'commercant') return 'role';
  if (!siret || !isValidSiret(siret)) return 'siret';
  return null;
}

export const WHOLESALE_BLOCK_MESSAGE: Record<Exclude<WholesaleBlock, null>, string> = {
  role: 'Les offres en gros sont réservées aux commerçants.',
  siret: 'Renseignez votre SIRET pour commander auprès d’un grossiste.',
};
