import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText, Screen } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { getMerchant } from '../model/catalog';
import { ME, SUPPORT, type Conversation } from '../model/schema';
import { lastMessageOf, unreadCount, useShopStore } from '../model/store';

/** « 14:03 » aujourd'hui, « hier », sinon « 12/07 ». */
function timeLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'hier';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

function Avatar({ partnerId }: { partnerId: string }) {
  const merchant = getMerchant(partnerId);
  if (partnerId === SUPPORT) {
    return (
      <View className="h-12 w-12 items-center justify-center rounded-pill bg-ink">
        <AppText className="font-display text-ink-inverse" style={{ fontSize: 15, lineHeight: 19 }}>
          F
        </AppText>
      </View>
    );
  }
  return (
    <View className="h-12 w-12 items-center justify-center rounded-pill bg-surface-muted">
      <AppText style={{ fontSize: 22, lineHeight: 27 }}>{merchant?.emoji ?? '🛍️'}</AppText>
    </View>
  );
}

function partnerName(partnerId: string): string {
  if (partnerId === SUPPORT) return 'Équipe Freedoo';
  return getMerchant(partnerId)?.name ?? 'Commerçant';
}

function Row({ conversation }: { conversation: Conversation }) {
  const router = useRouter();
  const last = useShopStore((s) => lastMessageOf(s, conversation.id));
  const unread = useShopStore((s) => unreadCount(s, conversation.id));

  return (
    <Pressable
      testID={`chat-${conversation.id}`}
      accessibilityRole="button"
      accessibilityLabel={`Conversation avec ${partnerName(conversation.partnerId)}${
        unread > 0 ? `, ${unread} non lus` : ''
      }`}
      // Forme objet, pas un littéral : le routeur typé n'accepte pas
      // `/discussion/${string}` pour une route dynamique.
      onPress={() => router.push({ pathname: '/discussion/[id]', params: { id: conversation.id } })}
      className="flex-row items-center gap-3 border-b border-line py-3.5 active:opacity-60"
    >
      <Avatar partnerId={conversation.partnerId} />

      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-2">
          <AppText
            className={cn('flex-1 text-ink', unread > 0 ? 'font-sans-bold' : 'font-sans-semibold')}
            numberOfLines={1}
          >
            {partnerName(conversation.partnerId)}
          </AppText>
          {last ? (
            <AppText
              variant="caption"
              className={cn(
                'text-xs',
                unread > 0 ? 'font-sans-bold text-brand-600' : 'text-ink-faint',
              )}
            >
              {timeLabel(last.created_at)}
            </AppText>
          ) : null}
        </View>

        <View className="flex-row items-center gap-2">
          <AppText
            variant="caption"
            numberOfLines={1}
            className={cn('flex-1', unread > 0 ? 'font-sans-medium text-ink' : 'text-ink-faint')}
          >
            {last
              ? `${last.sender_id === ME ? 'Vous : ' : ''}${last.body}`
              : 'Démarrer la discussion'}
          </AppText>
          {unread > 0 ? (
            <View className="h-5 min-w-[20px] items-center justify-center rounded-pill bg-brand-500 px-1.5">
              <AppText className="font-sans-bold text-ink-inverse" style={{ fontSize: 10 }}>
                {unread}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export function ChatListScreen() {
  const conversations = useShopStore((s) => s.conversations);
  // On s'abonne aussi aux messages : sans ça la liste ne se réordonnerait pas
  // quand une réponse arrive (getState() lit une fois, il ne réagit pas).
  const messages = useShopStore((s) => s.messages);

  // Le fil le plus récent en premier — l'ordre d'un vrai messenger.
  const ordered = useMemo(() => {
    const lastAt = (id: string) =>
      Date.parse(messages.filter((m) => m.conversation_id === id).at(-1)?.created_at ?? '0');
    return [...conversations].sort((a, b) => lastAt(b.id) - lastAt(a.id));
  }, [conversations, messages]);

  return (
    <Screen testID="chat-list-screen">
      <View className="pb-3 pt-2">
        <AppText variant="display">Messages</AppText>
        <AppText variant="caption" className="mt-1">
          Vos commerçants et l’équipe Freedoo.
        </AppText>
      </View>

      {ordered.length === 0 ? (
        <View className="items-center px-10 pt-20" testID="chat-empty">
          <Feather name="message-circle" size={30} color={colors.inkFaint} />
          <AppText variant="title" className="mt-3 text-center text-ink-faint">
            Aucune discussion
          </AppText>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-10">
          {ordered.map((c) => (
            <Row key={c.id} conversation={c} />
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}
