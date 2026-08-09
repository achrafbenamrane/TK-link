/**
 * PUBLIC API de la fidélité TK LINK — la carte, les points, les cadeaux, les
 * offres. Reprend le menu de la vidéo : CARTE FIDÉLITÉ · PROMO · CATALOGUE ·
 * BONUS POINT · CADEAUX.
 */
export { LoyaltyCardScreen } from './ui/card-screen';
export { GiftsScreen } from './ui/gifts-screen';
export { OffersScreen } from './ui/offers-screen';
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
