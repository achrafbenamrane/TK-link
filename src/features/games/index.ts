/**
 * PUBLIC API of the games feature — social-media-style mini-games that grant
 * coupons. Games are parameterized (image pool + onWin) so the feature stays
 * boundary-clean: the route composes shop's offer images with coupons' grant.
 */
export { GamesScreen } from './ui/games-screen';
export { GamesRail } from './ui/games-rail';
export { GamePlayer } from './ui/game-player';
export { MemoryGame } from './ui/memory-game';
export { QuizGame } from './ui/quiz-game';
export { GAME_TILES, playableGames, type GameKey, type GameTile } from './model/tiles';
export type { CardImage } from './model/memory';
export type { QuizItem } from './model/quiz';
