import { useRouter } from 'expo-router';

import {
  canSupplierPublish,
  MerchantOffersScreen,
  selectSupplier,
  ProLocked,
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

  // Un professionnel dont le dossier n'est pas validé ne publie pas (étape 6 des schémas).
  if ((role === 'grossiste' || role === 'commercant') && !canSupplierPublish(supplier.status)) {
    return (
      <ProLocked
        status={supplier.status}
        role={role}
        onOpenSetup={() => router.push('/dossier-pro')}
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
