import { useLocalSearchParams, useRouter } from 'expo-router';

import { MerchantLoyaltyScreen } from '@/features/loyalty';
import { getMerchant } from '@/features/shop';

/**
 * La carte de fidélité d'une enseigne. Le nom du commerçant vient du catalogue
 * (shop) et est passé en props : la fidélité ne dépend d'aucune autre feature.
 */
export default function FideliteRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const merchant = id ? getMerchant(id) : undefined;

  return (
    <MerchantLoyaltyScreen
      merchantId={id ?? ''}
      merchantName={merchant?.name ?? 'Ce commerçant'}
      merchantMeta={merchant ? `${merchant.area} · ★ ${merchant.rating}` : undefined}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
    />
  );
}
