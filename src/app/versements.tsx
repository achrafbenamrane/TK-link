import { useMemo } from 'react';

import { PayoutsScreen, selectOffers, useMerchantStore } from '@/features/merchant';
import {
  isHonoured,
  isMerchantOrder,
  selectOrders,
  summarizeOrder,
  useShopStore,
} from '@/features/shop';

/**
 * LES VERSEMENTS — V1.1, Commerçant > Flux finance.
 *
 * La route croise `merchant` (ce que j'ai publié) et `shop` (ce qui a été
 * commandé) pour ne garder que les ventes honorées de CE commerce.
 */
export default function VersementsRoute() {
  const orders = useShopStore(selectOrders);
  const published = useMerchantStore(selectOffers);

  const sales = useMemo(() => {
    const own = new Set(published.map((o) => `pub_${o.id}`));
    return orders
      .filter((o) => isHonoured(o) && isMerchantOrder(o, own))
      .map(summarizeOrder)
      .map((s) => ({ id: s.id, ref: s.ref, title: s.title, totalCents: s.totalCents }));
  }, [orders, published]);

  return <PayoutsScreen sales={sales} />;
}
