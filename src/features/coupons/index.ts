/**
 * PUBLIC API of the coupons feature — two sources (games + admin promo codes),
 * one wallet.
 */
export { CouponsScreen } from './ui/coupons-screen';
export { AdminCouponsScreen } from './ui/admin-coupons-screen';
export { useCouponsStore, selectWallet, selectAvailableCoupons } from './model/store';
export type { HeldCoupon, Discount } from './model/schema';
export { discountAmountCents, formatDiscount } from './lib/coupons';
export { GAME_REWARDS, pickGameReward, type GameReward } from './lib/rewards';
