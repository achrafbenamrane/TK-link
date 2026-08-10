import { useRouter } from 'expo-router';

import { MerchantOffersScreen } from '@/features/merchant';
import { selectFirstName, selectRole, useOnboardingStore } from '@/features/onboarding';

/**
 * L'espace de publication — CDC §9 et §20.
 *
 * Le même écran sert les deux vendeurs : le commerçant publie pour les clients,
 * le grossiste pour les commerçants. C'est la ROUTE qui traduit le rôle en
 * public visé — `merchant` ignore les rôles, `onboarding` ignore les offres.
 */
export default function MesOffresRoute() {
  const router = useRouter();
  const role = useOnboardingStore(selectRole);
  const firstName = useOnboardingStore(selectFirstName);

  return (
    <MerchantOffersScreen
      audience={role === 'grossiste' ? 'commercants' : 'clients'}
      seller={firstName}
      onBack={() => router.back()}
    />
  );
}
