import { useRouter } from 'expo-router';

import { RoleScreen, useOnboardingStore } from '@/features/onboarding';

/**
 * LE CHOIX DU PROFIL — avant l'inscription et la connexion.
 *
 * La route range le rôle puis ouvre l'inscription de ce profil : le client et
 * le commerçant partagent le formulaire (variantes), le livreur enchaîne ensuite
 * sur ses justificatifs, le grossiste sur le portail web.
 */
export default function RoleRoute() {
  const router = useRouter();
  const setRole = useOnboardingStore((s) => s.setRole);

  return (
    <RoleScreen
      onPick={(role) => {
        setRole(role);
        router.replace('/sign-up');
      }}
      onSignIn={() => router.replace('/sign-in')}
    />
  );
}
