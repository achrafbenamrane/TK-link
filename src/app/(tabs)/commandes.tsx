import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import { selectOffers, useMerchantStore, WholesalerOrdersScreen } from '@/features/merchant';
import { selectRole, useOnboardingStore } from '@/features/onboarding';
import { isSupabaseConfigured } from '@/shared/lib/env';
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

  // Le grossiste reçoit les commandes des COMMERÇANTS : ce n'est ni l'écran du client ni celui du commerce.
  if (role === 'grossiste') return <WholesalerOrdersScreen server={isSupabaseConfigured} />;
  return role === 'commercant' ? (
    <MerchantOrdersScreen
      dealIds={dealIds}
      // Avec un serveur : les commandes payées du commerce connecté (sinon, la démonstration locale).
      server={isSupabaseConfigured}
      onHandover={(orderId) => router.push({ pathname: '/remise/[id]', params: { id: orderId } })}
    />
  ) : (
    <OrdersScreen />
  );
}
