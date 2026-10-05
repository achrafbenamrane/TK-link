import { z } from 'zod';

export const MessageSchema = z.object({
  id: z.string(),
  from: z.enum(['me', 'them']),
  text: z.string(),
  /** Horodatage en millisecondes. */
  at: z.number(),
});
export type Message = z.infer<typeof MessageSchema>;

export const CONVERSATION_KINDS = ['commerce', 'client', 'support'] as const;
export type ConversationKind = (typeof CONVERSATION_KINDS)[number];

export const ConversationSchema = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string().default(''),
  kind: z.enum(CONVERSATION_KINDS),
  unread: z.number().int().nonnegative().default(0),
  messages: z.array(MessageSchema).default([]),
});
export type Conversation = z.infer<typeof ConversationSchema>;

/** Ce qui est conservé d'un lancement à l'autre. */
export const PersistedSchema = z.object({
  conversations: z.array(ConversationSchema).default([]),
});
