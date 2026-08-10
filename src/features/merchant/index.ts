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
  useMerchantStore,
  selectOffers,
  selectLots,
  selectUsed,
  selectPurchased,
  selectWholesaleOrders,
} from './model/store';
export type { Audience, OfferDraft, PublishedOffer, WholesaleOrder } from './model/schema';
export { AUDIENCES, DURATIONS } from './model/schema';
export {
  FREE_OPERATIONS,
  COMMISSION_PCT,
  PACKS,
  canPublish,
  commissionCents,
  formatCents,
  freeLeft,
  netCents,
  operationsLeft,
  parseEurosToCents,
  unitPriceCents,
  type Pack,
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
