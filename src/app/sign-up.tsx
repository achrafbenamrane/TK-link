import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { SignUpScreen } from '@/features/auth';
import { AvatarPicker, selectRole, useOnboardingStore } from '@/features/onboarding';

/**
 * INSCRIPTION — CDC V1.0 §2.2.
 *
 * La route compose : le rôle et l'avatar viennent de l'onboarding, le
 * formulaire vit dans `auth`. Les deux features s'ignorent ; c'est ici
 * qu'elles se rencontrent.
 *
 * Le compte ouvre le parcours (étape 2 du parcours du client) ; une fois
 * inscrit — ou en continuant sans compte — on enchaîne sur les centres
 * d'intérêt, la localisation et la sécurisation. La porte du layout laisse
 * passer tant que l'onboarding n'est pas terminé.
 */
export default function SignUpRoute() {
  const router = useRouter();
  const role = useOnboardingStore(selectRole);
  const setFirstName = useOnboardingStore((s) => s.setFirstName);
  const setSiret = useOnboardingStore((s) => s.setSiret);

  const onProfile = useCallback(
    ({ firstName, siret }: { firstName: string; siret: string }) => {
      setFirstName(firstName);
      setSiret(siret);
    },
    [setFirstName, setSiret],
  );
  const toOnboarding = useCallback(() => router.replace('/onboarding'), [router]);
  const toSignIn = useCallback(() => router.replace('/sign-in'), [router]);

  return (
    <SignUpScreen
      role={role}
      renderAvatar={() => <AvatarPicker />}
      onProfile={onProfile}
      onSignedUp={toOnboarding}
      onSignIn={toSignIn}
      onSkip={toOnboarding}
    />
  );
}
