import { useLocalSearchParams } from 'expo-router';

import { ProductScreen } from '@/features/shop';

export default function ProduitRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProductScreen dealId={id} />;
}
