import { z } from 'zod';

import { isCategory, type Category } from '@/shared/lib/categories';
import { ROLES } from '@/shared/lib/roles';

/**
 * Contrat de l'accueil des nouveaux utilisateurs.
 *
 * Demande du client : un onboarding « poussé », qui PERSONNALISE l'expérience,
 * avec une étape avatar dès le début. Ce qu'on y collecte doit donc réellement
 * changer l'app ensuite — sinon c'est un questionnaire pour rien.
 */

/**
 * Avatar composable. Pas d'image à télécharger : tout est dessiné en SVG, donc
 * net à toute taille et sans poids dans le bundle.
 */
export const AvatarSchema = z.object({
  /** Teinte du fond de la pastille. */
  hue: z.number().int().min(0).max(5).default(0),
  /** Forme du visage. */
  face: z.number().int().min(0).max(3).default(0),
  /** Accessoire (aucun, lunettes, casquette…). */
  accessory: z.number().int().min(0).max(3).default(0),
});
export type Avatar = z.infer<typeof AvatarSchema>;

/**
 * Centres d'intérêt — ce sont les 8 catégories du CDC (§4), pas une liste à
 * part. Le §7 exige que « les offres correspondant à ses catégories d'intérêt
 * soient présentées en priorité » : impossible à tenir si l'onboarding et
 * l'accueil ne parlent pas de la même chose.
 */
export type Interest = Category;

export const OnboardingSchema = z.object({
  completed: z.boolean().default(false),
  firstName: z.string().max(24).default(''),
  avatar: AvatarSchema.default({ hue: 0, face: 0, accessory: 0 }),
  /**
   * Rôle choisi à l'onboarding — CDC §4. Distinct de `holderType`, qui ne sert
   * qu'à l'audience des cadeaux fidélité : un consommateur peut être un
   * professionnel sans être commerçant sur la plateforme.
   */
  role: z.enum(ROLES).default('consommateur'),
  /**
   * SIRET du professionnel — CDC §5. Vide tant qu'il n'est pas renseigné : le
   * CDC ne l'exige qu'au moment de commander chez un grossiste, pas à
   * l'inscription.
   *
   * Stocké côté application (et non en stockage sécurisé) car c'est une donnée
   * d'entreprise publique au répertoire SIRENE, pas un secret. L'identité de la
   * personne (nom, e-mail, téléphone), elle, appartient au back-end.
   */
  siret: z.string().default(''),
  holderType: z.enum(['particulier', 'pro']).default('particulier'),
  medium: z.enum(['carte', 'pastille']).default('carte'),
  /**
   * Tolérant par construction : les installations d'avant le CDC contiennent
   * des identifiants disparus (`alimentation`, `carburant`…). Un `z.enum` strict
   * ferait échouer `safeParse`, et le store repartirait de zéro — l'utilisateur
   * se retrouverait à refaire l'onboarding. On filtre plutôt que d'échouer.
   */
  interests: z
    .array(z.string())
    .default([])
    .transform((list) => list.filter(isCategory)),
  /** L'utilisateur veut-il voir son impact écologique en tête ? */
  showEcoImpact: z.boolean().default(true),
});
export type OnboardingState = z.infer<typeof OnboardingSchema>;
