import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { OnboardingScreen, type OnboardingExit } from '@/features/onboarding';
import { authenticateBiometric, getUserCoord, useShopStore } from '@/features/shop';

/**
 * L'accueil des nouveaux, après la création du compte : centres d'intérêt,
 * localisation, sécurisation, compte validé — les étapes 3 à 6 du parcours que
 * le client a dessiné.
 *
 * La route compose. `onboarding` ne sait ni demander la position ni lire
 * l'empreinte : la boutique le sait, et la route lui prête ces deux gestes.
 * Les deux features s'ignorent, comme partout ailleurs.
 */
export default function OnboardingRoute() {
  const router = useRouter();
  const setUserCoord = useShopStore((s) => s.setUserCoord);
  const setBiometricEnabled = useShopStore((s) => s.setBiometricEnabled);

  const onDone = useCallback(
    (_next: OnboardingExit) => {
      // `replace` : revenir sur un onboarding terminé n'a aucun sens, et la
      // porte du layout renverrait aussitôt dans l'app.
      router.replace('/');
    },
    [router],
  );

  const onRequestLocation = useCallback(async () => {
    const coord = await getUserCoord();
    if (coord) setUserCoord(coord);
  }, [setUserCoord]);

  const onEnableBiometrics = useCallback(async () => {
    const result = await authenticateBiometric('Sécuriser votre compte');
    if (result.ok) setBiometricEnabled(true);
  }, [setBiometricEnabled]);

  return (
    <OnboardingScreen
      onDone={onDone}
      onRequestLocation={onRequestLocation}
      onEnableBiometrics={onEnableBiometrics}
    />
  );
}
