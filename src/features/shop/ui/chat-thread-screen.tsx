import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { cn } from '@/shared/lib/cn';
import { AppText, Screen } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { getMerchant } from '../model/catalog';
import { demoReplyFor } from '../model/chat-seed';
import { ME, SUPPORT, type ChatMessage } from '../model/schema';
import { useShopStore } from '../model/store';

function timeOf(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Séparateur de jour, comme dans un vrai messenger. */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Aujourd’hui';
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Hier';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

function Bubble({ message, mine }: { message: ChatMessage; mine: boolean }) {
  return (
    <Animated.View
      entering={FadeInDown.duration(180)}
      className={cn('mb-2 max-w-[80%]', mine ? 'self-end' : 'self-start')}
    >
      <View
        className={cn(
          'rounded-card px-3.5 py-2.5',
          mine ? 'rounded-br-sm bg-brand-500' : 'rounded-bl-sm border border-line bg-surface-muted',
        )}
      >
        <AppText className={cn('text-[15px]', mine ? 'text-ink-inverse' : 'text-ink')}>
          {message.body}
        </AppText>
      </View>
      <AppText
        variant="caption"
        className={cn('mt-1 text-[11px] text-ink-faint', mine ? 'text-right' : 'text-left')}
      >
        {timeOf(message.created_at)}
      </AppText>
    </Animated.View>
  );
}

/** Trois points animés — le fil ne doit pas paraître mort en attendant. */
function Typing() {
  return (
    <Animated.View entering={FadeInDown.duration(150)} className="mb-2 self-start">
      <View className="flex-row items-center gap-1 rounded-card rounded-bl-sm border border-line bg-surface-muted px-4 py-3">
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            className="h-1.5 w-1.5 rounded-pill bg-ink-faint"
            style={{ opacity: 0.3 + i * 0.25 }}
          />
        ))}
      </View>
    </Animated.View>
  );
}

export function ChatThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);

  const conversation = useShopStore((s) => s.conversations.find((c) => c.id === id));
  const messages = useShopStore((s) => s.messages);
  const send = useShopStore((s) => s.sendMessage);
  const receive = useShopStore((s) => s.receiveMessage);
  const markRead = useShopStore((s) => s.markConversationRead);

  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);

  const thread = useMemo(() => messages.filter((m) => m.conversation_id === id), [messages, id]);

  // Ouvrir le fil, c'est le lire.
  useEffect(() => {
    if (id) markRead(id);
  }, [id, markRead]);

  const partnerId = conversation?.partnerId ?? SUPPORT;
  const merchant = getMerchant(partnerId);
  const name = partnerId === SUPPORT ? 'Équipe TK LINK' : (merchant?.name ?? 'Commerçant');

  const onSend = () => {
    const text = draft.trim();
    if (!text || !id) return;
    send(id, text);
    setDraft('');

    // DÉMO — il n'y a pas de back-end : sans cette réponse simulée, le fil
    // resterait muet. À retirer quand la messagerie passera sur Supabase
    // Realtime (packs/chat-realtime).
    setTyping(true);
    const turn = thread.filter((m) => m.sender_id === ME).length;
    setTimeout(() => {
      setTyping(false);
      receive(id, partnerId, demoReplyFor(partnerId, turn));
    }, 1400);
  };

  if (!conversation) {
    return (
      <Screen testID="chat-thread-screen">
        <View className="flex-1 items-center justify-center gap-2">
          <Feather name="message-circle" size={28} color={colors.inkFaint} />
          <AppText variant="title" className="text-ink-faint">
            Discussion introuvable
          </AppText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} testID="chat-thread-screen">
      {/* En-tête : qui, et de quel quartier — le contexte d'un commerçant local. */}
      <View className="flex-row items-center gap-3 border-b border-line px-4 pb-3 pt-1">
        <Pressable
          testID="chat-back"
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={10}
          onPress={() => router.back()}
        >
          <Feather name="chevron-left" size={26} color={colors.ink} />
        </Pressable>

        <View className="h-10 w-10 items-center justify-center rounded-pill bg-surface-muted">
          {partnerId === SUPPORT ? (
            <Feather name="shield" size={17} color={colors.ink} />
          ) : (
            <AppText style={{ fontSize: 19, lineHeight: 24 }}>{merchant?.emoji ?? '🛍️'}</AppText>
          )}
        </View>

        <View className="flex-1">
          <AppText className="font-sans-bold text-ink" numberOfLines={1}>
            {name}
          </AppText>
          <AppText variant="caption" className="text-xs text-ink-faint">
            {partnerId === SUPPORT ? 'Répond en quelques minutes' : (merchant?.area ?? 'Toulouse')}
          </AppText>
        </View>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerClassName="px-4 py-4"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
        >
          {thread.map((m, i) => {
            const prev = thread[i - 1];
            const newDay =
              !prev ||
              new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
            return (
              <View key={m.id}>
                {newDay ? (
                  <AppText variant="caption" className="my-3 text-center text-xs text-ink-faint">
                    {dayLabel(m.created_at)}
                  </AppText>
                ) : null}
                <Bubble message={m} mine={m.sender_id === ME} />
              </View>
            );
          })}
          {typing ? <Typing /> : null}
        </ScrollView>

        <View className="flex-row items-end gap-2 border-t border-line bg-surface px-3 py-2.5">
          <TextInput
            testID="chat-input"
            value={draft}
            onChangeText={setDraft}
            placeholder="Écrivez un message…"
            placeholderTextColor={colors.inkFaint}
            multiline
            className="max-h-28 flex-1 rounded-card border border-line bg-surface-muted px-4 py-2.5 font-sans text-base text-ink"
            onSubmitEditing={onSend}
          />
          <Pressable
            testID="chat-send"
            accessibilityRole="button"
            accessibilityLabel="Envoyer"
            accessibilityState={{ disabled: !draft.trim() }}
            onPress={onSend}
            disabled={!draft.trim()}
            className={cn(
              'h-11 w-11 items-center justify-center rounded-pill',
              draft.trim() ? 'bg-brand-500 active:bg-brand-600' : 'bg-surface-sunken',
            )}
          >
            <Feather
              name="arrow-up"
              size={20}
              color={draft.trim() ? colors.inkInverse : colors.inkFaint}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
