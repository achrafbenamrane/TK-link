/**
 * Économie du programme de fidélité — source unique de vérité.
 *
 * ─── LE PRINCIPE ────────────────────────────────────────────────────────────
 * Le programme doit être rentable si TOUS les points sont utilisés.
 *
 * Beaucoup de programmes ne tiennent que grâce à la « casse » (breakage) : les
 * points que personne ne réclame — 10 à 30 % du total dans le commerce de
 * détail. C'est fragile (il suffit que les clients deviennent attentifs) et
 * c'est un pari contre son propre client.
 *
 * Conséquence directe : le partage de points entre proches ne coûte rien de
 * plus. Partager ne CRÉE pas de points, ça les déplace — la dette totale est
 * identique. Ça rapproche seulement le taux d'utilisation de 100 %. Si 100 %
 * est rentable, on garde un levier d'acquisition gratuit, sans plafond ni date
 * d'expiration à inventer.
 *
 * ─── LES CHIFFRES ───────────────────────────────────────────────────────────
 * Ce sont des valeurs de départ, pas une décision produit : elles attendent la
 * commission réelle négociée avec les commerçants. La règle à tenir :
 *
 *     taux de récompense  <  commission par transaction
 *
 * Sinon chaque euro dépensé coûte plus qu'il ne rapporte, partage ou pas.
 * `__tests__/loyalty.test.ts` échoue si ce plafond est franchi.
 */

/** Points gagnés par euro dépensé. */
export const POINTS_PER_EURO = 1;

/** Points à échanger contre un bon. */
export const REWARD_POINTS = 200;

/** Valeur du bon, en euros. */
export const REWARD_VALUE_EUR = 2;

/**
 * Commission estimée prélevée par TK LINK sur chaque transaction.
 *
 * ⚠️ HYPOTHÈSE À CONFIRMER AVEC LE CLIENT. Le cadrage dit « commission légère,
 * inférieure au prix d'un TPE » ; un terminal de paiement français coûte entre
 * 1,5 % et 2,5 %. On retient 2 % en attendant le chiffre réel — c'est le
 * plafond contre lequel le taux de récompense est vérifié.
 */
export const ASSUMED_COMMISSION_RATE = 0.02;

/**
 * Ce que le programme rend, en part du chiffre d'affaires.
 * 200 points = 200 € dépensés → un bon de 2 € = 1 %.
 */
export const rewardRate = (): number => REWARD_VALUE_EUR / (REWARD_POINTS / POINTS_PER_EURO);

/** Marge restante une fois la fidélité payée, en part du CA. */
export const netMarginRate = (): number => ASSUMED_COMMISSION_RATE - rewardRate();

/** Combien un panier moyen rapporte réellement, fidélité déduite. */
export const netMarginOn = (basketEur: number): number => basketEur * netMarginRate();
