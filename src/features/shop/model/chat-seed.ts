import type { ChatMessage, Conversation } from './schema';
import { SUPPORT } from './schema';

/**
 * Conversations de départ — l'écran doit avoir une histoire à raconter dès la
 * première ouverture. Un fil vide ne montre rien du produit.
 *
 * Les horodatages sont relatifs au lancement de l'app : figer des dates ferait
 * vieillir la démo (« il y a 4 mois ») à chaque fois qu'on la rejoue.
 */
const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000).toISOString();

export const CHAT_SEED: { conversations: Conversation[]; messages: ChatMessage[] } = {
  conversations: [
    // s3 non lu → l'onglet Chat porte une pastille dès l'ouverture.
    { id: 'c_hammamet', partnerId: 'm_hammamet', lastReadMessageId: 's2' },
    { id: 'c_petit', partnerId: 'm_petit', lastReadMessageId: 's4' },
    { id: 'c_support', partnerId: SUPPORT, lastReadMessageId: 's5' },
  ],
  messages: [
    {
      id: 's1',
      conversation_id: 'c_hammamet',
      sender_id: 'm_hammamet',
      body: 'Bonjour ! Votre côte de bœuf est réservée, je la prépare à la découpe.',
      created_at: minutesAgo(48),
    },
    {
      id: 's2',
      conversation_id: 'c_hammamet',
      sender_id: 'moi',
      body: 'Parfait, merci ! Vous pouvez le désosser ?',
      created_at: minutesAgo(45),
    },
    {
      id: 's3',
      conversation_id: 'c_hammamet',
      sender_id: 'm_hammamet',
      body: 'Bien sûr, c’est offert. Le livreur passe le prendre dans 20 minutes ⚡',
      created_at: minutesAgo(6),
    },
    {
      id: 's4',
      conversation_id: 'c_petit',
      sender_id: 'm_petit',
      body: 'Merci pour votre commande ! Le cassoulet part au four.',
      created_at: minutesAgo(180),
    },
    {
      id: 's5',
      conversation_id: 'c_support',
      sender_id: SUPPORT,
      body: 'Bienvenue sur TK LINK 👋 Une question sur une vente flash ? Écrivez-nous ici.',
      created_at: minutesAgo(1440),
    },
  ],
};

/**
 * Réponses automatiques de la démo. Le back-end n'existe pas encore : sans ça,
 * envoyer un message donne un fil mort et la démo ne montre rien.
 * À SUPPRIMER dès que la messagerie est branchée sur Supabase Realtime
 * (voir packs/chat-realtime).
 */
export const DEMO_REPLIES: Record<string, string[]> = {
  m_hammamet: [
    'Je regarde ça tout de suite 👀',
    'C’est noté, je vous prépare ça.',
    'Le livreur est en route, il arrive dans quelques minutes.',
  ],
  m_petit: ['Avec plaisir !', 'C’est prêt dans 10 minutes.', 'Merci à vous 🙏'],
  [SUPPORT]: [
    'Bonjour ! Un conseiller vous répond dans un instant.',
    'Je transmets au commerçant, vous avez la réponse très vite.',
    'C’est réglé — autre chose pour vous ?',
  ],
};

export function demoReplyFor(partnerId: string, turn: number): string {
  const pool = DEMO_REPLIES[partnerId] ?? DEMO_REPLIES[SUPPORT] ?? [];
  return pool[turn % pool.length] ?? 'Bien reçu !';
}
