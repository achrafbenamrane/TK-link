/**
 * PUBLIC API of the games feature — social-media-style mini-games that grant
 * coupons. Games are parameterized (image pool + onWin) so the feature stays
 * boundary-clean: the route composes shop's offer images with coupons' grant.
 */
export { GamesScreen } from './ui/games-screen';
export { MemoryGame } from './ui/memory-game';
export type { CardImage } from './model/memory';
