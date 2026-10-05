import { useMemo } from 'react';

import {
  MerchantStatsScreen,
  selectOffers,
  useMerchantStore,
  WholesalerStatsScreen,
} from '@/features/merchant';
import { selectRole, useOnboardingStore } from '@/features/onboarding';
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
  const role = useOnboardingStore(selectRole);

  const { honoured, count } = useMemo(() => {
    const own = new Set([...published.map((o) => `pub_${o.id}`), ...LOCAL_MERCHANT_DEAL_IDS]);
    const mine = orders.filter((o) => isMerchantOrder(o, own));
    return {
      honoured: mine.filter((o) => isHonoured(o)).map((o) => Math.round(o.total * 100)),
      count: mine.length,
    };
  }, [orders, published]);

  // Statistiques B2B tenues séparément des statistiques B2C (CDC V1.1, Grossiste).
  if (role === 'grossiste') return <WholesalerStatsScreen />;

  return <MerchantStatsScreen honouredTotalsCents={honoured} ordersCount={count} />;
}
