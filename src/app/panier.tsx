import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { earnedPoints, programOf, useMerchantLoyaltyStore } from '@/features/loyalty';
import { selectCredit, useReferralStore } from '@/features/referral';
import { isSupabaseConfigured } from '@/shared/lib/env';
import { usePlatformSettings } from '@/shared/lib/platform-overrides';
import { loadServerSettings } from '@/shared/lib/platform-server';
import { CartScreen, pointsByMerchant, selectOrders, useShopStore } from '@/features/shop';

/**
 * Racine de composition du panier : c'est ICI que la fidélité (feature à part)
 * rencontre la commande (feature shop). Le `CartScreen` ne connaît pas la
 * fidélité — il signale la commande passée, et la route crédite le programme de
 * chaque commerçant concerné (CDC §8.2 : les points restent liés au commerce
 * qui les a générés).
 *
 * Le parrainage aussi se compose ici : le crédit LOCAL (démonstration) pour une commande locale,
 * le crédit du SERVEUR (migration 0019, relu à chaque ouverture du panier) pour une commande du
 * serveur — c'est le serveur qui le déduit, le panier en montre l'estimation.
 */
export default function PanierRoute() {
  const earn = useMerchantLoyaltyStore((s) => s.earn);
  const credit = useReferralStore(selectCredit);
  const serverReferral = useReferralStore((s) => s.server);
  const syncReferral = useReferralStore((s) => s.syncServer);
  const settings = usePlatformSettings();
  useFocusEffect(
    useCallback(() => {
      if (!isSupabaseConfigured) return;
      void syncReferral();
      // La commission a pu changer depuis le lancement : l'estimation suit le serveur.
      void loadServerSettings();
    }, [syncReferral]),
  );

  return (
    <CartScreen
      // Le crédit de parrainage, une fois débloqué, se déduit du prochain paiement.
      credit={credit === 'disponible' ? settings.referralRewardEur : 0}
      serverCredit={serverReferral ? serverReferral.balanceCents / 100 : 0}
      onOrdered={(orderId) => {
        // Le crédit qui vient de servir est consommé AVANT que ce premier achat
        // n'en débloque un autre.
        const referral = useReferralStore.getState();
        referral.consumeCredit();
        referral.onPurchase();
        const order = selectOrders(useShopStore.getState()).find((o) => o.id === orderId);
        if (!order) return;
        const { programs } = useMerchantLoyaltyStore.getState();
        for (const [merchantId, eurosPoints] of Object.entries(pointsByMerchant(order))) {
          // L'unité est celle du programme de CE commerçant : euros ou achats.
          const { unit } = programOf(programs, merchantId);
          earn(merchantId, earnedPoints(unit, eurosPoints), 'Commande');
        }
      }}
    />
  );
}
