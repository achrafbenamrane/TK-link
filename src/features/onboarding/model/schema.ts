import { z } from 'zod';

import { isCategory, type Category } from '@/shared/lib/categories';
import { RoleSchema } from '@/shared/lib/roles';

/**
 * Contrat de l'accueil des nouveaux utilisateurs.
 *
 * Demande du client : un onboarding « poussé », qui PERSONNALISE l'expérience,
 * avec une étape avatar dès le début. Ce qu'on y collecte doit donc réellement
 * changer l'app ensuite — sinon c'est un questionnaire pour rien.
 */

/**
 * L'avatar PERSONNALISÉ — demande du client (15/10/2026) : un avatar modifiable façon Bitmoji,
 * avec tenue, détails du visage, casquette… et le logo TK LINK toujours sur les vêtements.
 *
 * Chaque champ est l'INDEX d'un choix dans `lib/avatar-parts.ts` (palettes et formes). On stocke
 * des entiers et non des couleurs ou du SVG : le fichier reste minuscule, et un index hors liste
 * (une version qui proposait moins de choix) est ramené dans la liste à l'affichage plutôt que de
 * faire échouer la lecture. Chaque champ a une valeur par défaut : un avatar enregistré avant
 * l'ajout d'un détail se relit sans erreur.
 */
const part = (fallback: number) => z.number().int().nonnegative().default(fallback);

export const CustomAvatarSchema = z.object({
  skin: part(1),
  face: part(0),
  freckles: part(0),
  eyes: part(0),
  eyeColor: part(0),
  brows: part(0),
  nose: part(0),
  mouth: part(0),
  hair: part(1),
  hairColor: part(1),
  beard: part(0),
  glasses: part(0),
  top: part(0),
  topColor: part(0),
  cap: part(0),
  capColor: part(1),
  bg: part(0),
});
export type CustomAvatar = z.infer<typeof CustomAvatarSchema>;

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
 *
 * Depuis le 15/10/2026 l'utilisateur peut aussi COMPOSER son avatar (`custom`, ci-dessus) : la
 * galerie reste, c'est un point de départ.
 */
export const AvatarSchema = z.object({
  /** Index dans la galerie. Borné à l'affichage, jamais ici. */
  preset: z.number().int().nonnegative().default(0),
  /**
   * L'avatar composé par l'utilisateur. Présent, il prime sur l'illustration de la galerie ;
   * absent, on affiche `preset`. `.catch` : un `custom` illisible est écarté, pas fatal.
   */
  custom: CustomAvatarSchema.optional().catch(undefined),
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
  /** Le prénom donné à l'inscription (CDC V1.0 §2.2) — pas un nom d'utilisateur à part. */
  firstName: z.string().max(24).default(''),
  avatar: AvatarSchema.default({ preset: 0 }),
  /**
   * Rôle — CDC §2.1. Un consommateur par défaut ; l'espace commerçant se choisit à la porte dédiée.
   *
   * Un `role: 'livreur'` enregistré avant le 13/11/2026 (rôle retiré, Uber Direct) se relit en
   * client (`RoleSchema`) ; une valeur illisible retombe sur le client plutôt que de faire échouer
   * toute la relecture — le prénom, l'avatar et les centres d'intérêt seraient perdus avec elle.
   */
  role: RoleSchema.default('consommateur').catch('consommateur'),
  /**
   * SIRET du professionnel — CDC §2.2. Vide tant qu'il n'est pas renseigné : le
   * CDC ne l'exige qu'au moment de commander chez un grossiste, pas à
   * l'inscription.
   *
   * Stocké côté application (et non en stockage sécurisé) car c'est une donnée
   * d'entreprise publique au répertoire SIRENE, pas un secret. L'identité de la
   * personne (nom, e-mail, téléphone), elle, appartient au back-end.
   */
  siret: z.string().default(''),
  /**
   * Tolérant par construction : les installations d'avant le CDC contiennent
   * des identifiants disparus (`alimentation`, `carburant`…). Un `z.enum` strict
   * ferait échouer `safeParse`, et le store repartirait de zéro — l'utilisateur
   * se retrouverait à refaire l'onboarding. On filtre plutôt que d'échouer.
   *
   * Les anciens champs `holderType`, `medium` et `showEcoImpact` ne sont plus
   * déclarés : Zod ignore les clés inconnues, un profil qui les contient se
   * relit donc sans erreur (voir le test de rétrocompatibilité).
   */
  /**
   * Le compte auquel appartient ce profil local (l'identifiant Supabase). Un AUTRE compte qui se
   * connecte sur cet appareil (session expirée, sans déconnexion) ne doit pas hériter des données
   * du précédent : la route racine compare et remet à zéro (ADR-0010). Vide : pas encore connu.
   */
  ownerId: z.string().max(64).default(''),
  interests: z
    .array(z.string())
    .default([])
    .transform((list) => list.filter(isCategory)),
});
export type OnboardingState = z.infer<typeof OnboardingSchema>;
