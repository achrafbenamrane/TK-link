import { useRouter } from 'expo-router';

import { WholesalerCatalogScreen } from '@/features/merchant';

/**
 * Le paramétrage du catalogue du grossiste — étape 7 de son process : stocks, lots, prix
 * pro, livraison.
 */
export default function CatalogueRoute() {
  const router = useRouter();
  return <WholesalerCatalogScreen onNewOffer={() => router.push('/flash')} />;
}
