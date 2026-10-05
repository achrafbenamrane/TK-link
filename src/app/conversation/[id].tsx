import { useLocalSearchParams, useRouter } from 'expo-router';

import { ThreadScreen } from '@/features/messages';

/** Une conversation : le fil de discussion avec le commerce, le client ou le support. */
export default function ConversationRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  return (
    <ThreadScreen
      conversationId={id ?? ''}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/messages'))}
    />
  );
}
