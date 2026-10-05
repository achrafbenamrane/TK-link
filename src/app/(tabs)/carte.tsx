import { useRouter } from 'expo-router';

import { CourierMapScreen } from '@/features/courier';
import { useMissionOffers } from '@/features/shop';

/** L'onglet « Carte » du livreur : la course en cours, du commerce au client. */
export default function CarteRoute() {
  const router = useRouter();
  const missions = useMissionOffers();
  return (
    <CourierMapScreen
      missions={missions}
      showExamples
      onOpenMissions={() => router.push('/missions')}
    />
  );
}
