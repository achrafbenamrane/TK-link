import { MerchantOffersScreen } from '@/features/merchant';
import { selectFirstName, selectRole, useOnboardingStore } from '@/features/onboarding';

/**
 * L'onglet central du commerçant : créer et suivre ses opérations Flash
 * (CDC V1.1, Commerçant > Process).
 *
 * Le même écran sert les deux vendeurs : le commerçant publie pour les clients,
 * le grossiste pour les commerçants. C'est la ROUTE qui traduit le rôle en
 * public visé — `merchant` ignore les rôles, `onboarding` ignore les offres.
 */
export default function FlashRoute() {
  const role = useOnboardingStore(selectRole);
  const firstName = useOnboardingStore(selectFirstName);

  return (
    <MerchantOffersScreen
      audience={role === 'grossiste' ? 'commercants' : 'clients'}
      seller={firstName}
    />
  );
}
