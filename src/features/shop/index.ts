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
export { BiometricsScreen } from './ui/biometrics-screen';
export { InvoicesScreen } from './ui/invoices-screen';
export { AddressesScreen } from './ui/addresses-screen';
export { MerchantScreen } from './ui/merchant-screen';
export { HelpScreen } from './ui/help-screen';
export { ChatListScreen } from './ui/chat-list-screen';
export { ChatThreadScreen } from './ui/chat-thread-screen';
export {
  useShopStore,
  selectCartCount,
  selectCartSubtotal,
  selectTotalUnread,
} from './model/store';
export { dealImagePool } from './model/product-images';
export { dealQuizPool } from './model/catalog';
