import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { AppText, Screen, ThemeToggle } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

import { preview, timeLabel } from '../lib/format';
import type { Conversation, ConversationKind } from '../model/schema';
import { selectConversations, useMessagesStore } from '../model/store';

const KIND_ICON: Record<ConversationKind, 'shopping-bag' | 'user' | 'headphones'> = {
  commerce: 'shopping-bag',
  client: 'user',
  support: 'headphones',
};

type Props = {
  onOpen: (conversationId: string) => void;
  onBack?: () => void;
};

const lastAt = (c: Conversation) => c.messages[c.messages.length - 1]?.at ?? 0;

/** LA LISTE DES CONVERSATIONS — la plus récente en haut. */
export function InboxScreen({ onOpen, onBack }: Props) {
  const colors = useColors();
  const conversations = useMessagesStore(selectConversations);
  const sorted = useMemo(
    () => [...conversations].sort((a, b) => lastAt(b) - lastAt(a)),
    [conversations],
  );
  const [now] = useState(() => Date.now());

  return (
    <Screen testID="messages-inbox">
      <View className="flex-row items-center justify-between py-4">
        <View className="flex-row items-center gap-3">
          {onBack ? (
            <Pressable
              testID="messages-inbox-back"
              accessibilityRole="button"
              accessibilityLabel="Revenir en arrière"
              hitSlop={10}
              onPress={onBack}
              className="h-10 w-10 items-center justify-center rounded-pill border border-line bg-surface active:opacity-70"
            >
              <Feather name="chevron-left" size={20} color={colors.ink} />
            </Pressable>
          ) : null}
          <AppText variant="display">Messages</AppText>
        </View>
        <ThemeToggle testID="messages-theme-toggle" />
      </View>

      {sorted.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <AppText testID="messages-empty" variant="caption">
            Aucune conversation pour l’instant.
          </AppText>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-6 gap-2">
          {sorted.map((c) => {
            const last = c.messages[c.messages.length - 1];
            return (
              <Pressable
                key={c.id}
                testID={`messages-row-${c.id}`}
                accessibilityRole="button"
                accessibilityLabel={`Ouvrir la conversation avec ${c.title}`}
                onPress={() => onOpen(c.id)}
                className="flex-row items-center gap-3 rounded-card border border-line bg-surface-muted p-3 active:opacity-70"
              >
                <View className="h-12 w-12 items-center justify-center rounded-pill bg-surface">
                  <Feather name={KIND_ICON[c.kind]} size={20} color={colors.brand500} />
                </View>
                <View className="min-w-0 flex-1">
                  <AppText className="font-sans-bold" numberOfLines={1}>
                    {c.title}
                  </AppText>
                  <AppText variant="caption" numberOfLines={1}>
                    {last ? preview(last.text) : 'Aucun message'}
                  </AppText>
                </View>
                <View className="items-end gap-1">
                  {last ? (
                    <AppText variant="caption" className="text-xs text-ink-faint">
                      {timeLabel(last.at, now)}
                    </AppText>
                  ) : null}
                  {c.unread > 0 ? (
                    <View
                      testID={`messages-unread-${c.id}`}
                      className="min-w-[20px] items-center rounded-pill bg-brand-500 px-1.5 py-0.5"
                    >
                      <AppText className="font-sans-bold text-xs text-white">{c.unread}</AppText>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </Screen>
  );
}
