import { useLocalSearchParams, useRouter } from 'expo-router';

import { selectCards, useMerchantLoyaltyStore } from '@/features/loyalty';
import { MerchantDetailScreen } from '@/features/shop';

/**
 * La fiche d'une enseigne. La boutique et la fidélité ne se connaissent pas :
 * c'est cette route qui les assemble — elle lit le solde et le passe en props.
 */
export default function EnseigneRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const cards = useMerchantLoyaltyStore(selectCards);
  const merchantId = id ?? '';

  return (
    <MerchantDetailScreen
      merchantId={merchantId}
      loyaltyPoints={cards[merchantId]?.points ?? 0}
      onOpenLoyalty={() => router.push({ pathname: '/fidelite/[id]', params: { id: merchantId } })}
      onOpenDeal={(dealId) => router.push({ pathname: '/produit/[id]', params: { id: dealId } })}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
    />
  );
}
