/**
 * PUBLIC API de la messagerie — liste des conversations et fil de discussion.
 * Local à l’appareil, sans serveur : envoyer ne simule jamais de réponse.
 *
 * Sans route depuis le 13/11/2026 : la messagerie servait le livreur (retiré, Uber Direct). Elle
 * attend d’être reprise pour le support TK LINK (étape 5 du plan du 13/11/2026).
 */
export { InboxScreen } from './ui/inbox-screen';
export { ThreadScreen } from './ui/thread-screen';
export {
  useMessagesStore,
  useConversation,
  selectConversations,
  selectUnreadTotal,
  type ConversationSeed,
} from './model/store';
export type { Conversation, ConversationKind, Message } from './model/schema';
