/**
 * LES PARAMÈTRES DE LA PLATEFORME — CDC V1.0 §12.3, mis à jour par la V1.1.
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
 * ⚠️ Un paramètre `null` n'est PAS un oubli : c'est un paramètre que
 * le client a explicitement laissé ouvert (aujourd'hui : la durée de
 * réservation du panier). Le lire renvoie `null`, et
 * l'appelant doit s'en accommoder plutôt que de deviner. Écrire une valeur
 * plausible à la place serait exactement ce que le §14 interdit.
 */

export type PlatformSettings = {
  /** Opérations Flash offertes avant le premier pack — CDC §6.2. */
  freeOperations: number;
  /** Commission TK LINK sur les transactions B2C, en pourcent — CDC §5.4. */
  commissionB2cPct: number;
  /**
   * Commission B2B, en pourcent — CDC V1.1, Grossiste > Règle (VALIDÉ) : « la
   * commission B2B est alignée sur le taux B2C (5 %) — décision du 31/08/2026
   * qui remplace la règle antérieure excluant tout calque automatique ». Elle
   * reste un paramètre administrable, jamais une constante du code.
   */
  commissionB2bPct: number;
  /**
   * Durée de réservation du stock au panier, en secondes — **absente**.
   *
   * CDC §4.4, classé ANALYSE EN COURS : « la durée exacte de réservation reste
   * à définir et doit être configurable ». La réservation elle-même exige de
   * toute façon un back-end (§12.2 : le serveur est autoritaire sur le stock).
   */
  cartHoldSeconds: number | null;
  /**
   * Frais de livraison facturés au client, en euros (le forfait). CDC V1.1 : le coût
   * de la livraison « s'affiche avant validation, jamais de frais caché ».
   *
   * Depuis le 13/11/2026, la course est confiée à Uber Direct (plus de livreurs
   * TK LINK, donc plus de rémunération de livreur ni de « colis important » à régler
   * ici) : le devis du partenaire remplacera ce barème quand le serveur le demandera.
   */
  deliveryFeeEur: number;
  /** Majoration par km au-delà de la zone de base, en euros — barème du 24/10/2026. */
  deliveryPerKmEur: number;
  /**
   * La zone de base, en km. `null` : aucune majoration n'est calculée, le forfait
   * seul s'applique — on n'invente pas de kilomètres facturés.
   */
  deliveryBaseZoneKm: number | null;
  /**
   * Récompense de parrainage, en euros, créditée à chacun des deux — CDC V1.1
   * (« 5 € crédités au parrain et au filleul »). Financée par TK LINK.
   */
  referralRewardEur: number;
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
/**
 * ⚖️ DÉCISIONS DU 24/10/2026 — Farid Terki a laissé au développeur le soin de trancher les valeurs
 * que le CDC ne chiffre pas. Elles sont arrêtées ici, EN TANT QUE VALEURS PAR DÉFAUT : le Super
 * Admin les change depuis l'onglet Réglages du back-office, sans toucher au code.
 *
 * - Zone de base de la livraison : 3 km — le rayon de recherche médian du CDC (1 / 3 / 5 / 10 km) ;
 *   au-delà, 0,80 €/km s'ajoute au 3,00 € de base.
 * - Frais de livraison payés par le client : 3,00 € — à l'époque, exactement ce que gagnait le
 *   livreur TK LINK pour une course dans la zone de base. Le CDC impose seulement que ce coût soit
 *   affiché AVANT la validation, jamais caché.
 *
 * Retirés le 13/11/2026 avec les livreurs (Uber Direct) : la rémunération du livreur et le seuil
 * du « colis important » (au-delà duquel la remise exigeait son empreinte).
 * - Réservation du stock au panier : 10 minutes (600 s) — le temps d'un paiement, pas de plus : un
 *   stock Flash bloqué plus longtemps pénaliserait les autres clients.
 *
 * Ce ne sont pas des règles de loi : si le client change d'avis, on change la valeur ci-dessous
 * (ou dans Réglages) et rien d'autre ne bouge.
 */
export const PLATFORM_SETTINGS: PlatformSettings = {
  freeOperations: 5,
  commissionB2cPct: 5,
  commissionB2bPct: 5,
  cartHoldSeconds: 600,
  deliveryFeeEur: 3,
  deliveryPerKmEur: 0.8,
  deliveryBaseZoneKm: 3,
  referralRewardEur: 5,
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
