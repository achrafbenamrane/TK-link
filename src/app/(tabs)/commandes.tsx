import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import { CourierEarningsScreen } from '@/features/courier';
import { selectOffers, useMerchantStore } from '@/features/merchant';
import { selectRole, useOnboardingStore } from '@/features/onboarding';
import { LOCAL_MERCHANT_DEAL_IDS, MerchantOrdersScreen, OrdersScreen } from '@/features/shop';

/**
 * L'onglet « Commandes » ne veut pas dire la même chose selon qui regarde.
 *
 * Un client suit ce qu'il a acheté. Un commerçant, lui, reçoit et prépare les
 * commandes de SES ventes : c'est son écran de service, et l'écran par défaut de
 * son appareil — V1.1, Commerçant > Règle : « la liste des commandes en cours,
 * pas les réglages ni les chiffres ». Ce qu'il commande lui-même aux grossistes
 * se trouve dans « Grossistes », depuis le tableau de bord.
 */
export default function CommandesRoute() {
  const router = useRouter();
  const role = useOnboardingStore(selectRole);
  const published = useMerchantStore(selectOffers);

  const dealIds = useMemo(
    () => [...published.map((o) => `pub_${o.id}`), ...LOCAL_MERCHANT_DEAL_IDS],
    [published],
  );

  if (role === 'livreur') return <CourierEarningsScreen />;
  return role === 'commercant' ? (
    <MerchantOrdersScreen
      dealIds={dealIds}
      onHandover={(orderId) => router.push({ pathname: '/remise/[id]', params: { id: orderId } })}
    />
  ) : (
    <OrdersScreen />
  );
}
