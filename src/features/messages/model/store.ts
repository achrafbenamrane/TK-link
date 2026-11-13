import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { makeId } from '@/shared/lib/id';
import { asyncStorageBackend } from '@/shared/lib/storage';

import { PersistedSchema, type Conversation, type ConversationKind } from './schema';

/**
 * Messagerie — locale à l’appareil, sans serveur.
 *
 * ⚠️ AUCUN ÉCRAN NE L’OUVRE depuis le 13/11/2026 : elle servait le livreur, retiré au profit
 * d’Uber Direct. Le store, la liste et le fil restent pour la messagerie du support TK LINK (étape 5
 * du plan du 13/11/2026), qui les reprendra avec un serveur.
 *
 * ⚠️ Envoyer un message ne simule JAMAIS de réponse : sans back-end, rien ne
 * répond. `receive` existe pour les tests.
 */

export type ConversationSeed = {
  id: string;
  title: string;
  subtitle?: string;
  kind: ConversationKind;
};

type State = {
  conversations: Conversation[];
  /** Crée la conversation si elle n’existe pas — sans toucher à l’existante. */
  ensureConversation: (seed: ConversationSeed) => void;
  /** Ajoute un message de moi ; faux si le texte est vide ou la conversation inconnue. */
  send: (conversationId: string, text: string) => boolean;
  markRead: (conversationId: string) => void;
  /** Ajoute un message reçu (tests). */
  receive: (conversationId: string, text: string) => void;
  reset: () => void;
};

export const useMessagesStore = create<State>()(
  persist(
    (set, get) => ({
      conversations: [],

      ensureConversation: (seed) => {
        if (get().conversations.some((c) => c.id === seed.id)) return;
        set((s) => ({
          conversations: [
            ...s.conversations,
            {
              id: seed.id,
              title: seed.title,
              subtitle: seed.subtitle ?? '',
              kind: seed.kind,
              unread: 0,
              messages: [],
            },
          ],
        }));
      },

      send: (conversationId, text) => {
        const clean = text.trim();
        if (!clean) return false;
        if (!get().conversations.some((c) => c.id === conversationId)) return false;
        const message = { id: makeId(), from: 'me' as const, text: clean, at: Date.now() };
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === conversationId ? { ...c, messages: [...c.messages, message] } : c,
          ),
        }));
        return true;
      },

      markRead: (conversationId) => {
        const target = get().conversations.find((c) => c.id === conversationId);
        if (!target || target.unread === 0) return;
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === conversationId ? { ...c, unread: 0 } : c,
          ),
        }));
      },

      receive: (conversationId, text) => {
        const clean = text.trim();
        if (!clean) return;
        const message = { id: makeId(), from: 'them' as const, text: clean, at: Date.now() };
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === conversationId
              ? { ...c, unread: c.unread + 1, messages: [...c.messages, message] }
              : c,
          ),
        }));
      },

      reset: () => set({ conversations: [] }),
    }),
    {
      name: 'tklink-messages-v1',
      storage: createJSONStorage(() => asyncStorageBackend),
      partialize: (s) => ({ conversations: s.conversations }),
      merge: (persisted, current) => {
        const parsed = PersistedSchema.safeParse(persisted);
        return parsed.success ? { ...current, ...parsed.data } : current;
      },
    },
  ),
);

export const selectConversations = (s: State) => s.conversations;
/** Un nombre (primitif) : stable pour zustand, pas de tableau recalculé. */
export const selectUnreadTotal = (s: State) => s.conversations.reduce((n, c) => n + c.unread, 0);

/** `find` renvoie l’objet déjà en mémoire : la sélection est stable. */
export const useConversation = (id: string): Conversation | undefined =>
  useMessagesStore((s) => s.conversations.find((c) => c.id === id));
