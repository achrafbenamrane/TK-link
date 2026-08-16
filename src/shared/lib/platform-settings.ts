/**
 * LES PARAMÈTRES DE LA PLATEFORME — CDC V1.0 §12.3.
 *
 * Le cahier des charges liste ce qui doit être **administrable** et pose une
 * règle de développement sans ambiguïté (§14) :
 *
 * > « Un paramètre non finalisé doit être prévu dans l'architecture, mais pas
 * > inventé. Autant que possible, il doit être administrable/configurable. »
 *
 * D'où ce module. Chaque valeur y est une **valeur par défaut nommée**, pas une
 * constante de loi : le jour où le Super Admin les édite, il écrit ici et rien
 * d'autre ne bouge. Le §6.2 est explicite sur le cas le plus visible — « le
 * nombre 5 doit être un paramètre Super Admin, et non une constante inscrite
 * dans le code ».
 *
 * ⚠️ Ce qui est `null` ci-dessous n'est PAS un oubli : c'est un paramètre que
 * le client a explicitement laissé ouvert. Le lire renvoie `null`, et
 * l'appelant doit s'en accommoder plutôt que de deviner. Écrire une valeur
 * plausible à la place serait exactement ce que le §14 interdit.
 */

export type PlatformSettings = {
  /** Opérations Flash offertes avant le premier pack — CDC §6.2. */
  freeOperations: number;
  /** Commission TK LINK sur les transactions B2C, en pourcent — CDC §5.4. */
  commissionB2cPct: number;
  /**
   * Commission B2B — **délibérément absente**.
   *
   * CDC §10.2 et Remarque 1 : « le taux de 5 % B2C ne doit pas être copié
   * automatiquement sur le B2B […] Aucun taux B2B ne doit être codé en dur. »
   * Les paniers, volumes et marges y sont sans commune mesure. Tant que Farid
   * n'a pas tranché, `null` — et tout écran qui affiche un montant B2B doit
   * dire qu'il ne le connaît pas, pas inventer 5 %.
   */
  commissionB2bPct: number | null;
  /**
   * Durée de réservation du stock au panier, en secondes — **absente**.
   *
   * CDC §4.4, classé ANALYSE EN COURS : « la durée exacte de réservation reste
   * à définir et doit être configurable ». La réservation elle-même exige de
   * toute façon un back-end (§12.2 : le serveur est autoritaire sur le stock).
   */
  cartHoldSeconds: number | null;
  /**
   * Plafond de transfert de points entre utilisateurs — **absent**.
   *
   * CDC §8.4 exige des « plafonds configurables » ; la Remarque 2 les classe à
   * finaliser. Aucune valeur ne doit être supposée.
   */
  pointsTransferCap: number | null;
  /** Points crédités par euro dépensé en produits — CDC §8.1. */
  pointsPerEuro: number;
  /** Conservation des pièces comptables, en années — CDC §9.6. */
  retentionYears: number;
};

/**
 * Les valeurs en vigueur.
 *
 * Elles viennent du CDC quand il tranche, et valent `null` quand il ne tranche
 * pas. Ce module remplacera un appel au back-end : la forme ne changera pas,
 * seule la source.
 */
export const PLATFORM_SETTINGS: PlatformSettings = {
  freeOperations: 5,
  commissionB2cPct: 5,
  commissionB2bPct: null,
  cartHoldSeconds: null,
  pointsTransferCap: null,
  pointsPerEuro: 1,
  retentionYears: 10,
};

/**
 * Un paramètre est-il arbitré ?
 *
 * Sert aux écrans qui doivent afficher « à définir » plutôt qu'un chiffre. Un
 * back-office qui montre « 0 % » là où la règle n'existe pas ment davantage
 * qu'un back-office qui l'avoue.
 */
export function isSettled<K extends keyof PlatformSettings>(key: K): boolean {
  return PLATFORM_SETTINGS[key] !== null;
}
