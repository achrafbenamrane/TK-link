import { selectRole, useOnboardingStore } from '@/features/onboarding';
import { ProfileScreen } from '@/features/shop';
import { audienceOf, canPublishOffers } from '@/shared/lib/roles';

/**
 * Le compte. La ROUTE croise le rôle (feature `onboarding`) avec la boutique :
 * un commerçant ou un grossiste voit « Mes ventes flash » (CDC §9), et seul le
 * commerçant voit les lots des grossistes (CDC §20 — le grossiste vend, il
 * n'achète pas sur la plateforme).
 */
export default function ProfilRoute() {
  const role = useOnboardingStore(selectRole);
  return (
    <ProfileScreen
      canPublishOffers={canPublishOffers(role)}
      canBuyWholesale={audienceOf(role) === 'grossiste'}
    />
  );
}
