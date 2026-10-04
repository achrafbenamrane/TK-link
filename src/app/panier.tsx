import { earnedPoints, programOf, useMerchantLoyaltyStore } from '@/features/loyalty';
import { selectCredit, useReferralStore } from '@/features/referral';
import { PLATFORM_SETTINGS } from '@/shared/lib/platform-settings';
import { CartScreen, pointsByMerchant, selectOrders, useShopStore } from '@/features/shop';

/**
 * Racine de composition du panier : c'est ICI que la fidélité (feature à part)
 * rencontre la commande (feature shop). Le `CartScreen` ne connaît pas la
 * fidélité — il signale la commande passée, et la route crédite le programme de
 * chaque commerçant concerné (CDC §8.2 : les points restent liés au commerce
 * qui les a générés).
 */
export default function PanierRoute() {
  const earn = useMerchantLoyaltyStore((s) => s.earn);
  const credit = useReferralStore(selectCredit);

  return (
    <CartScreen
      // Le crédit de parrainage, une fois débloqué, se déduit du prochain paiement.
      credit={credit === 'disponible' ? PLATFORM_SETTINGS.referralRewardEur : 0}
      onOrdered={(orderId) => {
        // Le crédit qui vient de servir est consommé AVANT que ce premier achat
        // n'en débloque un autre.
        const referral = useReferralStore.getState();
        referral.consumeCredit();
        referral.onPurchase();
        const order = selectOrders(useShopStore.getState()).find((o) => o.id === orderId);
        if (!order) return;
        const { programs } = useMerchantLoyaltyStore.getState();
        for (const [merchantId, eurosPoints] of Object.entries(pointsByMerchant(order))) {
          // L'unité est celle du programme de CE commerçant : euros ou achats.
          const { unit } = programOf(programs, merchantId);
          earn(merchantId, earnedPoints(unit, eurosPoints), 'Commande');
        }
      }}
    />
  );
}
