import { useLocalSearchParams, useRouter } from 'expo-router';

import { MerchantLoyaltyScreen } from '@/features/loyalty';
import { openStatus, selectProfile, useMerchantStore } from '@/features/merchant';
import { getMerchant, LOCAL_MERCHANT_ID } from '@/features/shop';

/**
 * La fidélité chez une enseigne. Le nom, la note et le quartier viennent du catalogue
 * (shop) et sont passés en props : la fidélité ne dépend d'aucune autre feature.
 */
export default function FideliteRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const merchant = id ? getMerchant(id) : undefined;
  const shop = useMerchantStore(selectProfile);

  // « Ouvert / Fermé » seulement pour l'enseigne de cet appareil, qui a réglé ses horaires.
  const status = id === LOCAL_MERCHANT_ID ? openStatus(shop.hours, new Date()) : '';
  const openState = status.startsWith('Ouvert')
    ? 'open'
    : status === 'Fermé'
      ? 'closed'
      : undefined;

  return (
    <MerchantLoyaltyScreen
      merchantId={id ?? ''}
      merchantName={merchant?.name ?? 'Ce commerçant'}
      {...(merchant ? { merchantRating: merchant.rating, merchantArea: merchant.area } : {})}
      {...(openState ? { openState } : {})}
      onOpenRewards={() => router.push('/recompenses')}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
    />
  );
}
