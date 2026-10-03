/**
 * La règle de calcul des points — CDC §8.1 et V1.1 (Utilisateur > Points).
 *
 * 1 € TTC réellement dépensé en produits = 1 point ; les frais annexes
 * (livraison, service, pourboire) en sont exclus par défaut. Les points sont
 * attribués par le commerçant, sur son propre programme : ils ne transitent
 * jamais par TK Link (V1.1, « la fidélité, un circuit séparé »).
 *
 * Aucune valeur de récompense ni taux de commission n'est fixé ici : les
 * paliers et les récompenses appartiennent au commerçant (CDC §8.3), et la
 * commission est un paramètre administrable (`shared/lib/platform-settings`).
 */

/** Points gagnés par euro dépensé. */
export const POINTS_PER_EURO = 1;
