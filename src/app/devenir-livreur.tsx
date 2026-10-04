import { useRouter } from 'expo-router';

import { CourierSetupScreen } from '@/features/courier';
import { useOnboardingStore } from '@/features/onboarding';
import { authenticateBiometric } from '@/features/shop';

/**
 * Le dépôt des justificatifs, la vérification et la sécurisation du livreur —
 * étapes 3 à 6 du schéma du client. La biométrie est celle du téléphone
 * (`shop`), passée en props : le livreur n'importe pas la boutique.
 */
export default function BecomeCourierRoute() {
  const router = useRouter();
  const complete = useOnboardingStore((s) => s.complete);

  return (
    <CourierSetupScreen
      authenticate={async (reason) => (await authenticateBiometric(reason)).ok}
      onDone={() => {
        // Le compte est prêt : la porte du premier lancement s'ouvre.
        complete();
        router.replace('/');
      }}
    />
  );
}
