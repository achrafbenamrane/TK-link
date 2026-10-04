/**
 * PUBLIC API de la fidélité TK LINK — CDC §8 et V1.1.
 *
 * La fidélité est propre à CHAQUE commerçant : ses points, ses paliers (jusqu'à
 * quatre), ses récompenses. Elle ne transite jamais par TK Link (V1.1, circuit
 * séparé). Les points bruts ne sont jamais transférables (V1.1, VALIDÉ) : seule
 * une récompense débloquée se partage, et cela viendra avec l'inventaire de
 * récompenses et le back-end.
 */
export { MerchantLoyaltyScreen } from './ui/merchant-loyalty-screen';
export { RewardsScreen } from './ui/rewards-screen';
export {
  useMerchantLoyaltyStore,
  selectCards,
  selectPrograms,
  selectRewards,
  type Reward,
  programOf,
  DEFAULT_TIERS,
  DEFAULT_PROGRAM,
  type Program,
  type MerchantCard,
  type HistoryEntry,
} from './model/merchant-store';
export {
  tierState,
  nextTier,
  pointsToGo,
  tierProgress,
  reachedCount,
  earnedPoints,
  PROGRAM_UNITS,
  UNIT_LABEL,
  MAX_TIERS,
  type ProgramUnit,
  type Tier,
  type TierState,
} from './lib/tiers';
export { TiersSettingsScreen } from './ui/tiers-settings-screen';
