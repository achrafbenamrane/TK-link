import { z } from 'zod';

import { isCategory } from '@/shared/lib/categories';
import { isValidSiret, normalizeSiret, type Role } from '@/shared/lib/roles';

/**
 * Le formulaire d'inscription — CDC §5.
 *
 * Une subtilité du CDC mérite d'être relevée, parce qu'il serait facile de la
 * rater : le SIRET n'est **pas** obligatoire à l'inscription. Le texte dit que
 * « l'accès et la consultation des offres se font avec les mêmes informations,
 * mais pour passer commande, le SIRET doit être renseigné ».
 *
 * Autrement dit : un commerçant s'inscrit et regarde librement ; c'est la
 * COMMANDE qui exige le SIRET (`wholesaleOrderBlock` dans `shared/lib/roles`).
 * Le rendre obligatoire ici ajouterait une barrière à l'inscription que le
 * client n'a pas demandée — et ferait perdre des comptes au premier écran.
 */

/** Numéro français : 0X ou +33X, tolérant aux espaces, points et tirets. */
const PHONE_RE = /^(?:\+33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/;

/** Longueur minimale du mot de passe, alignée sur l'écran de connexion. */
export const MIN_PASSWORD = 8;

export const RegistrationSchema = z
  .object({
    firstName: z.string().trim().min(2, 'Indiquez votre prénom.'),
    lastName: z.string().trim().min(2, 'Indiquez votre nom.'),
    email: z.email({ error: 'Entrez une adresse e-mail valide.' }),
    phone: z.string().trim().regex(PHONE_RE, 'Numéro invalide (ex. 06 12 34 56 78).'),
    password: z
      .string()
      .min(MIN_PASSWORD, `Le mot de passe doit faire au moins ${MIN_PASSWORD} caractères.`),
    confirm: z.string(),
    /**
     * CDC V1.0 §2.2 : « localisation selon consentement ». Elle est donc
     * FACULTATIVE — la maquette du client le dit aussi : « Ville / localisation
     * (optionnel) ». Une ville suffit à orienter les offres ; sans elle, c'est la
     * position du téléphone, si on l'autorise.
     */
    location: z.string().trim().default(''),
    /**
     * Facultatif à l'inscription (voir l'en-tête). Vide = non renseigné ;
     * renseigné = doit être un vrai SIRET, sinon autant ne rien saisir.
     */
    siret: z.string().default(''),
    shopName: z.string().default(''),
    category: z.string().default(''),
    address: z.string().default(''),
  })
  .refine((v) => v.password === v.confirm, {
    error: 'Les deux mots de passe ne correspondent pas.',
    path: ['confirm'],
  })
  .refine((v) => v.siret.trim() === '' || isValidSiret(v.siret), {
    error: 'Ce SIRET est invalide (14 chiffres).',
    path: ['siret'],
  });

export type Registration = z.infer<typeof RegistrationSchema>;

/** Un formulaire vierge — la forme attendue par l'écran. */
export const EMPTY_REGISTRATION = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  confirm: '',
  location: '',
  siret: '',
  /** Professionnels seulement — voir `validateRegistration`. */
  shopName: '',
  category: '',
  address: '',
};
export type RegistrationDraft = typeof EMPTY_REGISTRATION;

/**
 * Le SIRET est-il pertinent pour ce rôle ? — CDC §5.
 *
 * On ne montre le champ qu'aux professionnels : demander son SIRET à un
 * consommateur n'a aucun sens et allonge un formulaire déjà long.
 */
export function needsSiret(role: Role): boolean {
  // Commerçant et grossiste sont des professionnels ; le livreur (TK Deliver)
  // s'inscrit comme une personne — ses justificatifs viennent à l'étape suivante.
  return role === 'commercant' || role === 'grossiste';
}

/**
 * Ce qu'un PROFESSIONNEL doit de plus à l'inscription — maquette « Créer mon
 * compte commerçant » et V1.1 (Commerçant > Process) : le nom du commerce, sa
 * catégorie et son adresse. Le SIRET, lui, reste facultatif ici (voir l'en-tête).
 */
function proErrors(draft: RegistrationDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  if (draft.shopName.trim().length < 2) errors.shopName = 'Indiquez le nom de votre commerce.';
  if (!isCategory(draft.category)) errors.category = 'Choisissez une catégorie.';
  if (draft.address.trim().length < 3) errors.address = 'Indiquez l’adresse de votre commerce.';
  return errors;
}

/** Erreurs par champ, prêtes à afficher. Vide = le formulaire est valide. */
export function validateRegistration(
  draft: RegistrationDraft,
  role: Role = 'consommateur',
): Record<string, string> {
  const errors: Record<string, string> = {};
  const result = RegistrationSchema.safeParse(draft);
  if (!result.success) {
    for (const issue of result.error.issues) {
      const key = issue.path[0];
      // Premier message par champ : empiler trois erreurs sur un même champ ne
      // rend pas le formulaire plus clair, seulement plus décourageant.
      if (typeof key === 'string' && !errors[key]) errors[key] = issue.message;
    }
  }
  if (needsSiret(role)) {
    for (const [key, message] of Object.entries(proErrors(draft))) {
      if (!errors[key]) errors[key] = message;
    }
  }
  return errors;
}

/**
 * Ce qu'on garde du formulaire une fois validé.
 *
 * Le mot de passe n'en fait volontairement PAS partie : il part vers le
 * fournisseur d'authentification et ne doit jamais atterrir dans un store
 * persisté. Le SIRET est normalisé pour être comparé et affiché de façon
 * stable.
 */
export function toProfile(draft: RegistrationDraft) {
  return {
    firstName: draft.firstName.trim(),
    lastName: draft.lastName.trim(),
    email: draft.email.trim().toLowerCase(),
    phone: draft.phone.trim(),
    location: draft.location.trim(),
    siret: draft.siret.trim() === '' ? null : normalizeSiret(draft.siret),
    shopName: draft.shopName.trim(),
    category: draft.category,
    address: draft.address.trim(),
  };
}
