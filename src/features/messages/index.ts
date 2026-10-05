/**
 * PUBLIC API de la messagerie — liste des conversations et fil de discussion.
 * Local à l’appareil, sans serveur : envoyer ne simule jamais de réponse.
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
export { missionConversation, type MissionLike } from './lib/mission-conversation';
export type { Conversation, ConversationKind, Message } from './model/schema';
