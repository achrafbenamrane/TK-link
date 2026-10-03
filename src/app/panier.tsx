import { useMerchantLoyaltyStore } from '@/features/loyalty';
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

  return (
    <CartScreen
      onOrdered={(orderId) => {
        const order = selectOrders(useShopStore.getState()).find((o) => o.id === orderId);
        if (!order) return;
        for (const [merchantId, points] of Object.entries(pointsByMerchant(order))) {
          earn(merchantId, points, 'Commande');
        }
      }}
    />
  );
}
