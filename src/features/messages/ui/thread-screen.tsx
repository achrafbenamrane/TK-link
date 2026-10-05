import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText, Screen, TextField } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

import { timeLabel } from '../lib/format';
import { useConversation, useMessagesStore } from '../model/store';

type Props = {
  conversationId: string;
  onBack: () => void;
};

/** UNE CONVERSATION — bulles, et la zone de saisie en bas. */
export function ThreadScreen({ conversationId, onBack }: Props) {
  const colors = useColors();
  const conversation = useConversation(conversationId);
  const send = useMessagesStore((s) => s.send);
  const markRead = useMessagesStore((s) => s.markRead);
  const [draft, setDraft] = useState('');
  const [now] = useState(() => Date.now());
  const scroller = useRef<ScrollView>(null);

  const unread = conversation?.unread ?? 0;
  const count = conversation?.messages.length ?? 0;

  // Ouvrir la conversation, c’est lire : un message reçu pendant qu’elle est
  // ouverte ne doit pas rester « non lu ».
  useEffect(() => {
    if (unread > 0) markRead(conversationId);
  }, [conversationId, unread, markRead]);

  useEffect(() => {
    scroller.current?.scrollToEnd({ animated: true });
  }, [count]);

  const canSend = draft.trim().length > 0;
  const submit = () => {
    if (send(conversationId, draft)) setDraft('');
  };

  return (
    <Screen testID="messages-thread">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-row items-center gap-3 py-4">
          <Pressable
            testID="messages-back"
            accessibilityRole="button"
            accessibilityLabel="Revenir en arrière"
            hitSlop={10}
            onPress={onBack}
            className="h-10 w-10 items-center justify-center rounded-pill border border-line bg-surface active:opacity-70"
          >
            <Feather name="chevron-left" size={20} color={colors.ink} />
          </Pressable>
          {conversation ? (
            <View className="min-w-0 flex-1">
              <AppText variant="title" numberOfLines={1} testID="messages-thread-title">
                {conversation.title}
              </AppText>
              {conversation.subtitle ? (
                <AppText variant="caption" numberOfLines={1}>
                  {conversation.subtitle}
                </AppText>
              ) : null}
            </View>
          ) : null}
        </View>

        {!conversation ? (
          <View className="flex-1 items-center justify-center">
            <AppText testID="messages-not-found" variant="caption">
              Conversation introuvable
            </AppText>
          </View>
        ) : (
          <>
            <ScrollView
              ref={scroller}
              testID="messages-list"
              className="flex-1"
              contentContainerClassName="gap-2 py-2"
              showsVerticalScrollIndicator={false}
            >
              {conversation.messages.map((m) => {
                const mine = m.from === 'me';
                return (
                  <View
                    key={m.id}
                    testID={`messages-bubble-${m.id}`}
                    className={cn(
                      'max-w-[80%] rounded-card px-3 py-2',
                      mine ? 'self-end bg-brand-500' : 'self-start bg-surface-muted',
                    )}
                  >
                    <AppText className={cn('text-[15px]', mine ? 'text-white' : 'text-ink')}>
                      {m.text}
                    </AppText>
                    <AppText
                      className={cn(
                        'mt-0.5 text-[11px]',
                        mine ? 'self-end text-white' : 'self-start text-ink-faint',
                      )}
                    >
                      {timeLabel(m.at, now)}
                    </AppText>
                  </View>
                );
              })}
            </ScrollView>

            <View className="flex-row items-end gap-2 pb-3 pt-2">
              <TextField
                testID="messages-input"
                value={draft}
                onChangeText={setDraft}
                placeholder="Votre message"
                multiline
                numberOfLines={4}
                className="h-auto max-h-28 min-h-[48px] py-3"
              />
              <Pressable
                testID="messages-send"
                accessibilityRole="button"
                accessibilityLabel="Envoyer"
                accessibilityState={{ disabled: !canSend }}
                disabled={!canSend}
                onPress={submit}
                className={cn(
                  'h-12 w-12 items-center justify-center rounded-pill bg-brand-500 active:opacity-70',
                  !canSend && 'opacity-40',
                )}
              >
                <Feather name="send" size={18} color="#FFFFFF" />
              </Pressable>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}
