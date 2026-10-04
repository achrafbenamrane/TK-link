import { useLocalSearchParams, useRouter } from 'expo-router';

import { selectCards, useMerchantLoyaltyStore } from '@/features/loyalty';
import { openStatus, selectProfile, useMerchantStore } from '@/features/merchant';
import { LOCAL_MERCHANT_ID, MerchantDetailScreen } from '@/features/shop';

/**
 * La fiche d'une enseigne. La boutique et la fidélité ne se connaissent pas :
 * c'est cette route qui les assemble — elle lit le solde et le passe en props.
 */
export default function EnseigneRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const cards = useMerchantLoyaltyStore(selectCards);
  const merchantId = id ?? '';
  const shop = useMerchantStore(selectProfile);
  // Seule l'enseigne de CET appareil a une vitrine réglée ; les autres viennent du catalogue.
  const profile =
    merchantId === LOCAL_MERCHANT_ID
      ? {
          presentation: shop.presentation,
          photos: shop.photos,
          status: openStatus(shop.hours, new Date()),
        }
      : undefined;

  return (
    <MerchantDetailScreen
      merchantId={merchantId}
      loyaltyPoints={cards[merchantId]?.points ?? 0}
      {...(profile ? { profile } : {})}
      onOpenLoyalty={() => router.push({ pathname: '/fidelite/[id]', params: { id: merchantId } })}
      onOpenDeal={(dealId) => router.push({ pathname: '/produit/[id]', params: { id: dealId } })}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
    />
  );
}
