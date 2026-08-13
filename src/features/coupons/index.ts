/**
 * PUBLIC API of the coupons feature.
 *
 * Deux sources — les jeux et les codes promo — un seul portefeuille, consommé
 * au panier. La SAISIE d'un code vit dans La Chasse (un code se perd si on
 * doit le chercher) ; le portefeuille garde son écran, atteint depuis le
 * compte, pour voir ce qu'on possède.
 */
export { PromoCodeField } from './ui/promo-code-field';
export { CouponsScreen } from './ui/coupons-screen';
export { useCouponsStore, selectWallet, selectAvailableCoupons } from './model/store';
export type { HeldCoupon, Discount } from './model/schema';
export { discountAmountCents, formatDiscount } from './lib/coupons';
export { GAME_REWARDS, pickGameReward, type GameReward } from './lib/rewards';
