import { useRouter } from 'expo-router';

import { CourierSetupScreen } from '@/features/courier';
import { useOnboardingStore } from '@/features/onboarding';
import { authenticateBiometric } from '@/features/shop';
import { isDemoBuild } from '@/shared/lib/env';

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
      demo={isDemoBuild}
      authenticate={async (reason) => (await authenticateBiometric(reason)).ok}
      onDone={() => {
        // Le compte est prêt : la porte du premier lancement s'ouvre.
        complete();
        router.replace('/');
      }}
    />
  );
}
