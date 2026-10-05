import type { ConversationSeed } from '../model/store';

/** Ce que la messagerie sait d'une mission : de quoi nommer l'interlocuteur, rien de plus. */
export type MissionLike = {
  orderId: string;
  merchantName: string;
  merchantArea: string;
  clientName?: string | undefined;
  dropoff: string;
};

/** La mission d'exemple du démo : ses conversations sont celles de la messagerie d'exemple. */
const DEMO_ORDER_ID = 'demo_8892';

/**
 * La conversation qu'ouvre un bouton « Message » (ou « Support ») : avec le commerce de la
 * mission, avec son client, ou avec le support TK LINK. Un identifiant stable par mission et
 * par interlocuteur : rouvrir le bouton retrouve le même fil, il n'en crée pas un second.
 */
export function missionConversation(
  who: 'commerce' | 'client' | 'support',
  mission: MissionLike | null,
): ConversationSeed {
  if (who === 'support' || !mission) {
    return { id: 'support', title: 'Support TK LINK', subtitle: 'Aide & contact', kind: 'support' };
  }
  const demo = mission.orderId === DEMO_ORDER_ID;
  if (who === 'commerce') {
    return {
      id: demo ? 'demo_commerce' : `${mission.orderId}:commerce`,
      title: mission.merchantName,
      subtitle: mission.merchantArea,
      kind: 'commerce',
    };
  }
  return {
    id: demo ? 'demo_client' : `${mission.orderId}:client`,
    title: mission.clientName ?? 'Client',
    subtitle: mission.dropoff,
    kind: 'client',
  };
}
