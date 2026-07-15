/**
 * PUBLIC API of the shop feature (Freedoo buyer app).
 * Routes wire URLs to these screens; everything else is internal.
 */
export { HomeScreen } from './ui/home-screen';
export { ProductScreen } from './ui/product-screen';
export { CartScreen } from './ui/cart-screen';
export { OrdersScreen } from './ui/orders-screen';
export { FavoritesScreen } from './ui/favorites-screen';
export { ProfileScreen } from './ui/profile-screen';
export { useShopStore, selectCartCount } from './model/store';
