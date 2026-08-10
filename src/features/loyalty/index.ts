/**
 * PUBLIC API de la fidélité TK LINK — la carte, les points, les cadeaux, les
 * offres. Reprend le menu de la vidéo : CARTE FIDÉLITÉ · PROMO · CATALOGUE ·
 * BONUS POINT · CADEAUX.
 */
export { LoyaltyCardScreen } from './ui/card-screen';
export { GiftsScreen } from './ui/gifts-screen';
export { OffersScreen } from './ui/offers-screen';
export { OffersRail } from './ui/offers-rail';
export {
  useLoyaltyStore,
  selectCard,
  selectEntries,
  selectGifts,
  selectOffers,
  selectBalance,
  selectClaimedGiftIds,
} from './model/store';
export type { Gift, LoyaltyCard, Offer, PointsEntry, HolderType, CardMedium } from './model/schema';
export {
  balanceOf,
  canClaim,
  pointsForCents,
  pointsMissing,
  progressToward,
  nextGift,
  formatCardNumber,
  isOfferLive,
  timeLeft,
  POINTS_PER_EURO,
} from './lib/loyalty';

/* ---- fidélité PAR COMMERÇANT (le modèle de la maquette client) ---- */
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
  withdraw,
  transferCode,
  type Tier,
  type TierState,
} from './lib/tiers';
