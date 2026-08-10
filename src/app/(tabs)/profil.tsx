import { selectRole, useOnboardingStore } from '@/features/onboarding';
import { ProfileScreen } from '@/features/shop';
import { canPublishOffers } from '@/shared/lib/roles';

/**
 * Le compte. La ROUTE croise le rôle (feature `onboarding`) avec la boutique :
 * seul un commerçant ou un grossiste voit l'entrée « Mes ventes flash » — CDC §9.
 */
export default function ProfilRoute() {
  const role = useOnboardingStore(selectRole);
  return <ProfileScreen canPublishOffers={canPublishOffers(role)} />;
}
