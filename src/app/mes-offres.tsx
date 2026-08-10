import { useRouter } from 'expo-router';

import { MerchantOffersScreen } from '@/features/merchant';

/** L'espace du commerçant : publier une vente flash et suivre ce qu'elle rapporte (CDC §9). */
export default function MesOffresRoute() {
  const router = useRouter();
  return <MerchantOffersScreen onBack={() => router.back()} />;
}
