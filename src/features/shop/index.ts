/**
 * PUBLIC API of the shop feature (TK LINK buyer app).
 * Routes wire URLs to these screens; everything else is internal.
 */
export { HomeScreen } from './ui/home-screen';
export { ProductScreen } from './ui/product-screen';
export { CartScreen } from './ui/cart-screen';
export { OrdersScreen } from './ui/orders-screen';
export { OrderDetailScreen } from './ui/order-detail-screen';
export { FavoritesScreen } from './ui/favorites-screen';
export { ProfileScreen } from './ui/profile-screen';
export { PreferencesScreen } from './ui/preferences-screen';
export { LiquidationRail } from './ui/components/liquidation-rail';
export { orderToTransaction, producesReceipt, type Transaction } from './lib/transactions';
export { selectOrders } from './model/store';
export { pointsByMerchant } from './lib/points';
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
export { MerchantOrdersScreen } from './ui/merchant-orders-screen';
export { MerchantDetailScreen } from './ui/merchant-detail-screen';
export { useShopStore, selectCartCount, selectCartSubtotal } from './model/store';
export { getMerchant, MERCHANTS } from './model/catalog';
/** Le contrat d'une offre affichable — sert aux routes qui en fabriquent une
 *  à partir d'une autre feature (les ventes flash du commerçant, CDC §9). */
export type { Deal } from './model/schema';
export { LOCAL_MERCHANT_ID } from './model/catalog';
