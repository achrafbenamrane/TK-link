import { useEffect, useMemo } from 'react';

import { PayoutsScreen, selectOffers, useMerchantStore } from '@/features/merchant';
import {
  isHonoured,
  isMerchantOrder,
  selectOrders,
  selectShopServerOrders,
  summarizeOrder,
  useServerOrdersStore,
  useShopStore,
} from '@/features/shop';
import { isSupabaseConfigured } from '@/shared/lib/env';

/**
 * LES VERSEMENTS — V1.1, Commerçant > Flux finance.
 *
 * La route croise `merchant` (ce que j'ai publié) et `shop` (ce qui a été
 * commandé) pour ne garder que les ventes honorées de CE commerce. Avec un serveur, ce sont les
 * commandes du serveur reçues par le commerce, et l'écran propose l'inscription aux paiements
 * Stripe.
 */
export default function VersementsRoute() {
  const orders = useShopStore(selectOrders);
  const published = useMerchantStore(selectOffers);
  const serverOrders = useServerOrdersStore(selectShopServerOrders);
  const refreshShop = useServerOrdersStore((s) => s.refreshShop);

  useEffect(() => {
    if (isSupabaseConfigured) void refreshShop();
  }, [refreshShop]);

  const sales = useMemo(() => {
    const own = new Set(published.map((o) => `pub_${o.id}`));
    const honoured = isSupabaseConfigured
      ? serverOrders.filter(isHonoured)
      : orders.filter((o) => isHonoured(o) && isMerchantOrder(o, own));
    return honoured
      .map(summarizeOrder)
      .map((s) => ({ id: s.id, ref: s.ref, title: s.title, totalCents: s.totalCents }));
  }, [orders, published, serverOrders]);

  return <PayoutsScreen sales={sales} server={isSupabaseConfigured} />;
}
