/**
 * PUBLIC API de la progression — ce qui fait de l'app une chasse plutôt qu'une
 * boutique : rang, XP, série, missions du jour.
 */
export { HunterBar } from './ui/hunter-bar';
export { useGameStore, selectXp, selectStreak, selectCounts } from './model/store';
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
