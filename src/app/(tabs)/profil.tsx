import { selectRole, useOnboardingStore } from '@/features/onboarding';
import { ProfileScreen } from '@/features/shop';
import { canPublishOffers } from '@/shared/lib/roles';

/**
 * Le compte. La ROUTE croise le rôle (feature `onboarding`) avec la boutique :
 * un professionnel y trouve le renvoi vers l'espace pro web, où il publie ses
 * ventes flash et suit ses commandes — décision client du 2026-08-10.
 */
export default function ProfilRoute() {
  const role = useOnboardingStore(selectRole);
  return <ProfileScreen canPublishOffers={canPublishOffers(role)} />;
}
