import { useMemo } from 'react';

import { MerchantStatsScreen, selectOffers, useMerchantStore } from '@/features/merchant';
import {
  isHonoured,
  isMerchantOrder,
  LOCAL_MERCHANT_DEAL_IDS,
  selectOrders,
  useShopStore,
} from '@/features/shop';

/**
 * Les statistiques du commerçant, calculées sur SES commandes : la route croise
 * l'espace commerçant et la boutique, qui ne s'importent pas.
 */
export default function StatsRoute() {
  const orders = useShopStore(selectOrders);
  const published = useMerchantStore(selectOffers);

  const { honoured, count } = useMemo(() => {
    const own = new Set([...published.map((o) => `pub_${o.id}`), ...LOCAL_MERCHANT_DEAL_IDS]);
    const mine = orders.filter((o) => isMerchantOrder(o, own));
    return {
      honoured: mine.filter((o) => isHonoured(o)).map((o) => Math.round(o.total * 100)),
      count: mine.length,
    };
  }, [orders, published]);

  return <MerchantStatsScreen honouredTotalsCents={honoured} ordersCount={count} />;
}
