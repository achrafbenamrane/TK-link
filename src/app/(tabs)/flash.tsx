import { useRouter } from 'expo-router';

import {
  canSupplierPublish,
  MerchantOffersScreen,
  selectSupplier,
  SupplierLocked,
  useMerchantStore,
} from '@/features/merchant';
import { selectFirstName, selectRole, useOnboardingStore } from '@/features/onboarding';
import { useShopStore } from '@/features/shop';

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
  const application = useShopStore((s) => s.merchantApplication);
  const supplier = useMerchantStore(selectSupplier);
  const router = useRouter();

  // Un fournisseur non validé ne publie pas (étape 6 du schéma grossiste).
  if (role === 'grossiste' && !canSupplierPublish(supplier.status)) {
    return (
      <SupplierLocked
        status={supplier.status}
        onOpenSetup={() => router.push('/devenir-fournisseur')}
      />
    );
  }

  return (
    <MerchantOffersScreen
      audience={role === 'grossiste' ? 'commercants' : 'clients'}
      seller={firstName}
      {...(application?.shopName ? { shopName: application.shopName } : {})}
    />
  );
}
