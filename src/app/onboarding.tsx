import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { selectIsAuthenticated, useAuthStore } from '@/features/auth';
import { OnboardingScreen, type OnboardingExit } from '@/features/onboarding';

/**
 * L'accueil des nouveaux : impact, rôle, avatar, profil, intérêts, compte.
 *
 * La route compose. `onboarding` décide de la SUITE (« créer un compte », « me
 * connecter », « plus tard ») et elle la traduit en URL ; `auth` dit s'il y a
 * déjà une session, ce qui retire l'étape du compte. Les deux features
 * s'ignorent, comme partout ailleurs.
 */
export default function OnboardingRoute() {
  const router = useRouter();
  const hasAccount = useAuthStore(selectIsAuthenticated);

  const onDone = useCallback(
    (next: OnboardingExit) => {
      // `replace` partout : revenir en arrière sur un onboarding terminé n'a
      // aucun sens, et la porte du layout renverrait aussitôt dans l'app.
      if (next === 'sign-up') router.replace('/sign-up');
      else if (next === 'sign-in') router.replace('/sign-in');
      else router.replace('/');
    },
    [router],
  );

  return <OnboardingScreen onDone={onDone} hasAccount={hasAccount} />;
}
