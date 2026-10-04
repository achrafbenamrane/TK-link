import { useEffect } from 'react';

import { selectRole, useOnboardingStore } from '@/features/onboarding';

import SignUpRoute from './sign-up';

/**
 * LA PORTE DES LIVREURS — « Créer mon compte livreur » (TK Deliver).
 *
 * Étape 2 du parcours du client : la même inscription que les autres rôles, sans
 * les champs professionnels. La route pose le rôle avant de la montrer ; les
 * justificatifs (identité, selfie, zone, véhicule) viennent à l'étape suivante,
 * dans `/devenir-livreur`.
 */
export default function CourierSignUpRoute() {
  const role = useOnboardingStore(selectRole);
  const setRole = useOnboardingStore((s) => s.setRole);

  useEffect(() => {
    if (role !== 'livreur') setRole('livreur');
  }, [role, setRole]);

  return <SignUpRoute />;
}
