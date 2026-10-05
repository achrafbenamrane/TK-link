import { useRouter } from 'expo-router';

import { InboxScreen } from '@/features/messages';

/** L'onglet « Messages » : le commerce, le client et le support TK LINK. */
export default function MessagesRoute() {
  const router = useRouter();
  return (
    <InboxScreen onOpen={(id) => router.push({ pathname: '/conversation/[id]', params: { id } })} />
  );
}
