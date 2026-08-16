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
 * Avatar : un choix dans la galerie d'illustrations (`model/avatars.ts`).
 *
 * L'ancien avatar était composé (teinte + visage + accessoire) et dessiné en
 * SVG. Les illustrations livrées par le client racontent bien mieux à qui
 * l'app parle — mais elles ne se composent pas : un avatar tient désormais en
 * UN entier.
 *
 * Rétrocompatible sans effort : Zod ignore les clés inconnues, donc un avatar
 * stocké au format `{hue, face, accessory}` se relit en `{preset: 0}` au lieu
 * de faire échouer la réhydratation et de renvoyer l'utilisateur à
 * l'onboarding. Il repart sur la première illustration, et peut en changer.
 */
export const AvatarSchema = z.object({
  /** Index dans la galerie. Borné à l'affichage, jamais ici. */
  preset: z.number().int().nonnegative().default(0),
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
  avatar: AvatarSchema.default({ preset: 0 }),
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
  /**
   * Support physique — CONSERVÉ mais plus demandé.
   *
   * Le client a écarté le matériel (« on reste uniquement sur du soft ») et le
   * CDC V1.0 n'en parle plus : l'onboarding ne pose donc plus la question.
   * Le champ, lui, reste dans le schéma PERSISTÉ. Le retirer ferait échouer
   * `safeParse` sur les profils déjà enregistrés, et effacerait prénom, avatar,
   * rôle et centres d'intérêt — pour supprimer une valeur que plus personne ne
   * lit. On le laisse mourir de sa belle mort, avec son défaut.
   */
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
