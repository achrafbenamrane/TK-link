import { useRouter } from 'expo-router';

import { CourierMissionsScreen, type MessageTarget, type Mission } from '@/features/courier';
import { missionConversation, useMessagesStore } from '@/features/messages';
import { authenticateBiometric, useMissionOffers, useShopStore } from '@/features/shop';

/**
 * L'onglet « Missions » du livreur : missions proposées, mission active, navigation et
 * validation finale. La route met en relation les commandes (`shop`), la biométrie du
 * téléphone (`shop`) et la messagerie (`messages`) : le livreur n'importe aucune des trois.
 */
export default function MissionsRoute() {
  const router = useRouter();
  const missions = useMissionOffers();
  const setOrderStatus = useShopStore((s) => s.setOrderStatus);
  const ensureConversation = useMessagesStore((s) => s.ensureConversation);

  const openMessage = (who: MessageTarget, mission: Mission | null) => {
    const seed = missionConversation(who, mission);
    ensureConversation(seed);
    router.push({ pathname: '/conversation/[id]', params: { id: seed.id } });
  };

  return (
    <CourierMissionsScreen
      missions={missions}
      authenticate={authenticateBiometric}
      onPickedUp={(orderId) => setOrderStatus(orderId, 'en_livraison')}
      onDelivered={(orderId) => setOrderStatus(orderId, 'livree')}
      onMessage={openMessage}
      // Démonstration au client : des missions d'exemple tant qu'aucune vraie course n'existe.
      showExamples
    />
  );
}
