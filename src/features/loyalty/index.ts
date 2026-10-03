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
export {
  useMerchantLoyaltyStore,
  selectCards,
  DEFAULT_TIERS,
  type MerchantCard,
  type HistoryEntry,
} from './model/merchant-store';
export {
  tierState,
  nextTier,
  pointsToGo,
  tierProgress,
  reachedCount,
  type Tier,
  type TierState,
} from './lib/tiers';
export { TiersSettingsScreen } from './ui/tiers-settings-screen';
