import { useRouter } from 'expo-router';

import { useAuthStore } from '@/features/auth';
import { CourierSetupScreen } from '@/features/courier';
import { useOnboardingStore } from '@/features/onboarding';
import { authenticateBiometric } from '@/features/shop';
import { isDemoBuild } from '@/shared/lib/env';
import { franceConnectProvider } from '@/shared/lib/france-connect';

/**
 * Le dépôt des justificatifs, la vérification et la sécurisation du livreur —
 * étapes 3 à 6 du schéma du client. La biométrie est celle du téléphone
 * (`shop`), passée en props : le livreur n'importe pas la boutique.
 */
export default function BecomeCourierRoute() {
  const router = useRouter();
  const complete = useOnboardingStore((s) => s.complete);
  const saveOnboarding = useAuthStore((s) => s.saveOnboarding);

  return (
    <CourierSetupScreen
      demo={isDemoBuild}
      franceConnect={franceConnectProvider()}
      authenticate={async (reason) => (await authenticateBiometric(reason)).ok}
      onDone={() => {
        // Le compte est prêt : la porte du premier lancement s'ouvre — et le compte s'en souvient.
        complete();
        void saveOnboarding(useOnboardingStore.getState().interests);
        router.replace('/');
      }}
    />
  );
}
