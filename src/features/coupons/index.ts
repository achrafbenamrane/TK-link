/**
 * PUBLIC API of the coupons feature.
 *
 * Deux sources de coupons — les jeux et les codes promo — un seul portefeuille,
 * consommé au panier. Il n'y a plus d'écran dédié : la saisie d'un code vit
 * dans La Chasse, et les coupons se choisissent au moment de payer.
 */
export { PromoCodeField } from './ui/promo-code-field';
export { useCouponsStore, selectWallet, selectAvailableCoupons } from './model/store';
export type { HeldCoupon, Discount } from './model/schema';
export { discountAmountCents, formatDiscount } from './lib/coupons';
export { GAME_REWARDS, pickGameReward, type GameReward } from './lib/rewards';
