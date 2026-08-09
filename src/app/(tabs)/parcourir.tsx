import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import { selectCards, useMerchantLoyaltyStore } from '@/features/loyalty';
import { BrowseScreen } from '@/features/shop';

/**
 * PARCOURIR — la découverte par commerce.
 *
 * Distinct de l'accueil : celui-ci déroule les ventes flash, celui-là cherche
 * une enseigne. Les soldes de fidélité viennent de la feature « loyalty » et
 * sont passés en props — la boutique ne l'importe pas.
 */
export default function ParcourirRoute() {
  const router = useRouter();
  const cards = useMerchantLoyaltyStore(selectCards);

  const loyaltyByMerchant = useMemo(
    () => Object.fromEntries(Object.entries(cards).map(([id, c]) => [id, c.points])),
    [cards],
  );

  return (
    <BrowseScreen
      loyaltyByMerchant={loyaltyByMerchant}
      onOpenMerchant={(id) => router.push({ pathname: '/enseigne/[id]', params: { id } })}
    />
  );
}
