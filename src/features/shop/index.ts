/**
 * PUBLIC API of the shop feature (Freedoo buyer app).
 * Routes wire URLs to these screens; everything else is internal.
 */
export { HomeScreen } from './ui/home-screen';
export { ProductScreen } from './ui/product-screen';
export { CartScreen } from './ui/cart-screen';
export type { CartCoupons, CartCouponOption } from './ui/cart-screen';
export { OrdersScreen } from './ui/orders-screen';
export { OrderDetailScreen } from './ui/order-detail-screen';
export { FavoritesScreen } from './ui/favorites-screen';
export { ProfileScreen } from './ui/profile-screen';
export { PreferencesScreen } from './ui/preferences-screen';
export { BrowseScreen } from './ui/browse-screen';
export { LiquidationRail } from './ui/components/liquidation-rail';
export { criticalDealCount } from './model/catalog';
export {
  summarize,
  sortSummaries,
  searchSummaries,
  flashLabel,
  SORT_LABEL,
  type MerchantSummary,
  type SortKey,
} from './lib/browse';
export {
  applyPreferences,
  filterDeals,
  toggleLifeStyle,
  activeFilterCount,
  DEFAULT_PREFERENCES,
  COLLECT_LABEL,
  LIFESTYLE_LABEL,
  RADII,
  type Preferences,
  type CollectType,
  type LifeStyle,
} from './lib/preferences';
export { BiometricsScreen } from './ui/biometrics-screen';
export { InvoicesScreen } from './ui/invoices-screen';
export { AddressesScreen } from './ui/addresses-screen';
export { MerchantScreen } from './ui/merchant-screen';
export { MerchantDetailScreen } from './ui/merchant-detail-screen';
export { HelpScreen } from './ui/help-screen';
export { ChatListScreen } from './ui/chat-list-screen';
export { ChatThreadScreen } from './ui/chat-thread-screen';
export {
  useShopStore,
  selectCartCount,
  selectCartSubtotal,
  selectTotalUnread,
} from './model/store';
export { dealImagePool, dealQuizPool, getMerchant, MERCHANTS } from './model/catalog';
export type { GameImageSource } from './model/catalog';
/** Le contrat d'une offre affichable — sert aux routes qui en fabriquent une
 *  à partir d'une autre feature (les ventes flash du commerçant, CDC §9). */
export type { Deal } from './model/schema';
export { LOCAL_MERCHANT_ID } from './model/catalog';
