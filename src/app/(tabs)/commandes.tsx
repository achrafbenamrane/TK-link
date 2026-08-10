import { MerchantPurchasesScreen } from '@/features/merchant';
import { selectRole, useOnboardingStore } from '@/features/onboarding';
import { OrdersScreen } from '@/features/shop';

/**
 * L'onglet « Commandes » ne veut pas dire la même chose selon qui regarde.
 *
 * Un client suit ce qu'il a acheté chez les commerçants. Un commerçant, lui,
 * vient s'approvisionner (décision client du 2026-08-10 : ses ventes se
 * pilotent sur le web) — il doit donc voir ce qu'il a COMMANDÉ aux grossistes,
 * et pas les commandes d'un client qu'il n'est pas.
 */
export default function CommandesRoute() {
  const role = useOnboardingStore(selectRole);
  return role === 'commercant' ? <MerchantPurchasesScreen /> : <OrdersScreen />;
}
