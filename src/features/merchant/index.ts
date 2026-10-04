/**
 * PUBLIC API de l'espace commerçant — CDC §9 et §21.
 *
 * Le commerçant publie ses ventes flash, suit ce qu'elles rapportent, et voit
 * son quota d'opérations (cinq offertes, puis des packs) comme la commission
 * de 5 % qui s'appliquera. Rien d'autre : la gestion complète (stock, factures,
 * B2B) est du ressort du portail web.
 */
export { MerchantOffersScreen } from './ui/offers-screen';
export { WholesaleScreen } from './ui/wholesale-screen';
export { MerchantPurchasesScreen } from './ui/purchases-screen';
export {
  MerchantDashboardScreen,
  type DashboardOrder,
  type DashboardTarget,
} from './ui/dashboard-screen';
export { PayoutsScreen, type PayoutLine } from './ui/payouts-screen';
export { ShopSettingsScreen } from './ui/shop-settings-screen';
export { WholesalerOrdersScreen } from './ui/wholesaler-orders-screen';
export { WholesalerDashboardScreen, type WholesalerTarget } from './ui/wholesaler-dashboard-screen';
export {
  WHOLESALE_STATUSES,
  WHOLESALE_STATUS_LABEL,
  type WholesaleStatus,
} from './lib/wholesale-orders';
export { MerchantStatsScreen } from './ui/stats-screen';
export { DAY_LABEL, DAYS, openStatus, type Hours } from './lib/shop-profile';
export {
  useMerchantStore,
  selectOffers,
  selectLots,
  selectUsed,
  selectPurchased,
  selectWholesaleOrders,
  selectProfile,
} from './model/store';
export type { ShopProfile } from './model/schema';
export type { Audience, OfferDraft, PublishedOffer, WholesaleOrder } from './model/schema';
export { AUDIENCES, DURATIONS, FLASH_MIN_MINUTES, FLASH_MAX_MINUTES } from './model/schema';
export {
  FREE_OPERATIONS,
  COMMISSION_PCT,
  canPublish,
  commissionCents,
  formatCents,
  freeLeft,
  netCents,
  operationsLeft,
  parseEurosToCents,
} from './lib/billing';
export {
  discountPct,
  endsAt,
  isLive,
  liveOffers,
  potentialCents,
  secondsLeft,
  soldCents,
  stateOf,
  STATE_LABEL,
  type OfferState,
} from './lib/offers';
