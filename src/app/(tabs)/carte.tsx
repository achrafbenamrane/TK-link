import { useRouter } from 'expo-router';

import { LoyaltyCardScreen } from '@/features/loyalty';

/** CARTE FIDÉLITÉ + BONUS POINT — ce qu'on présente au lecteur en caisse. */
export default function CarteRoute() {
  const router = useRouter();
  return <LoyaltyCardScreen onOpenGifts={() => router.push('/cadeaux')} />;
}
