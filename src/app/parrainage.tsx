import { ReferralScreen } from '@/features/referral';
import { useShopStore } from '@/features/shop';

/**
 * Le parrainage. La route lit la boutique (« a-t-on déjà commandé ? ») et le
 * passe en props : le parrainage n'importe pas la boutique.
 */
export default function ParrainageRoute() {
  const hasOrdered = useShopStore((s) => s.orders.length > 0);
  return <ReferralScreen hasOrdered={hasOrdered} />;
}
