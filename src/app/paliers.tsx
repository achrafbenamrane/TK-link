import { TiersSettingsScreen } from '@/features/loyalty';

/**
 * Le barème de fidélité du commerçant — CDC §8.3.
 *
 * Route à part plutôt qu'un écran de plus dans l'espace commerçant : les
 * paliers appartiennent à la tranche `loyalty`, et une tranche n'importe pas sa
 * voisine. C'est la route qui les met à portée du commerçant.
 */
export default TiersSettingsScreen;
