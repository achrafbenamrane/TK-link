import { selectRole, useOnboardingStore } from '@/features/onboarding';
import { OrderDetailScreen } from '@/features/shop';

/**
 * La fiche d'une commande. Un compte commerçant n'achète qu'aux grossistes (migration 0023) : sa
 * commande se lit avec les mots du B2B — le grossiste prépare et livre lui-même.
 */
export default function CommandeRoute() {
  const role = useOnboardingStore(selectRole);
  return <OrderDetailScreen wholesale={role === 'commercant'} />;
}
