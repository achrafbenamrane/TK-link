import { TiersSettingsScreen } from '@/features/loyalty';

/**
 * L'onglet « Fidélité » du commerçant : le barème qu'il règle lui-même
 * (CDC §8.3 — jusqu'à quatre paliers, seuil, récompense, description).
 *
 * Route d'onglet plutôt qu'écran de plus dans le compte : les paliers
 * appartiennent à la tranche `loyalty`, et une tranche n'importe pas sa voisine.
 */
export default TiersSettingsScreen;
