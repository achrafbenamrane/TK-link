import { useRouter } from 'expo-router';

import { CourierMapScreen } from '@/features/courier';
import { useMissionOffers } from '@/features/shop';
import { isDemoBuild } from '@/shared/lib/env';

/** L'onglet « Carte » du livreur : la course en cours, du commerce au client. */
export default function CarteRoute() {
  const router = useRouter();
  const missions = useMissionOffers();
  return (
    <CourierMapScreen
      missions={missions}
      showExamples={isDemoBuild}
      onOpenMissions={() => router.push('/missions')}
    />
  );
}
