/**
 * PUBLIC API de la progression — ce qui fait de l'app une chasse plutôt qu'une
 * boutique : rang, XP, série, missions du jour, coffre, trophées, classement.
 *
 * Tout cela se voit dans UN seul endroit, l'onglet « La Chasse » (`HubScreen`).
 * L'accueil n'en porte plus rien : il montre le déstockage, point.
 */
export { HubScreen } from './ui/hub-screen';
export { MissionList } from './ui/mission-list';
export { useGameStore, selectXp, selectStreak, selectCounts, selectLastChest } from './model/store';
export {
  CHEST_TIERS,
  chestAvailable,
  rollChest,
  type ChestReward,
  type ChestTier,
  type ChestTierKey,
} from './lib/chest';
export { badgesOf, earnedCount, type Badge } from './lib/badges';
export { neighbourhoodBoard, xpToPassNext, youRow, type LeaderRow } from './lib/leaderboard';
export {
  RANKS,
  XP,
  rankOf,
  nextRank,
  levelProgress,
  bumpStreak,
  isStreakAlive,
  dayKey,
  daysBetween,
  dailyMissions,
  missionDone,
  missionRatio,
  missionsDone,
  EMPTY_COUNTS,
  type Rank,
  type Mission,
  type MissionKind,
  type DailyCounts,
  type Streak,
  type XpSource,
} from './lib/progression';
