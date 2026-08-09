import { z } from 'zod';

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

/** Centres d'intérêt — pilotent le tri des offres et du catalogue. */
export const InterestSchema = z.enum([
  'alimentation',
  'restauration',
  'carburant',
  'transport',
  'fournitures',
  'sante',
  'loisirs',
]);
export type Interest = z.infer<typeof InterestSchema>;

export const OnboardingSchema = z.object({
  completed: z.boolean().default(false),
  firstName: z.string().max(24).default(''),
  avatar: AvatarSchema.default({ hue: 0, face: 0, accessory: 0 }),
  holderType: z.enum(['particulier', 'pro']).default('particulier'),
  medium: z.enum(['carte', 'pastille']).default('carte'),
  interests: z.array(InterestSchema).default([]),
  /** L'utilisateur veut-il voir son impact écologique en tête ? */
  showEcoImpact: z.boolean().default(true),
});
export type OnboardingState = z.infer<typeof OnboardingSchema>;
