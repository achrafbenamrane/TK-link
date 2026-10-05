import type { Conversation } from '../model/schema';

const MIN = 60_000;
const HOUR = 60 * MIN;

/**
 * Conversations d’exemple. Aucune réponse automatique n’est jamais simulée :
 * ce sont des messages déjà « reçus », rien de plus.
 */
export function demoConversations(now: number = Date.now()): Conversation[] {
  return [
    {
      id: 'demo_commerce',
      title: 'Sushi Tokyo',
      subtitle: '12 rue des Arts, 31000 Toulouse',
      kind: 'commerce',
      unread: 0,
      messages: [
        {
          id: 'demo_commerce_1',
          from: 'them',
          text: 'Bonjour, la commande #CMD-8892 sera prête dans 5 minutes.',
          at: now - 12 * MIN,
        },
        { id: 'demo_commerce_2', from: 'me', text: 'Parfait, j’arrive.', at: now - 10 * MIN },
      ],
    },
    {
      id: 'demo_client',
      title: 'Emma Bernard',
      subtitle: '24 rue des Lilas, 31000 Toulouse',
      kind: 'client',
      unread: 1,
      messages: [
        {
          id: 'demo_client_1',
          from: 'them',
          text: 'Bonjour ! Sonnez à l’interphone, 2ème étage à droite.',
          at: now - 3 * MIN,
        },
      ],
    },
    {
      id: 'support',
      title: 'Support TK LINK',
      subtitle: 'Aide & contact',
      kind: 'support',
      unread: 0,
      messages: [
        {
          id: 'support_1',
          from: 'them',
          text: 'Bonjour, comment pouvons-nous vous aider ?',
          at: now - 26 * HOUR,
        },
      ],
    },
  ];
}
