import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { SignUpScreen } from '@/features/auth';
import { selectRole, useOnboardingStore } from '@/features/onboarding';

/**
 * INSCRIPTION — CDC §5.
 *
 * La route compose : le rôle vient de l'onboarding, le formulaire vit dans
 * `auth`. Les deux features s'ignorent ; c'est ici qu'elles se rencontrent.
 */
export default function SignUpRoute() {
  const router = useRouter();
  const role = useOnboardingStore(selectRole);
  const setSiret = useOnboardingStore((s) => s.setSiret);

  const onSiretChange = useCallback((siret: string) => setSiret(siret), [setSiret]);
  const onSignedUp = useCallback(() => router.replace('/'), [router]);

  return <SignUpScreen role={role} onSiretChange={onSiretChange} onSignedUp={onSignedUp} />;
}
