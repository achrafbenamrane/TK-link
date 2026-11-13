import { useRouter } from 'expo-router';

import { SupportScreen } from '@/features/support';

/** Aide et support : les demandes adressées à TK LINK. */
export default function SupportRoute() {
  const router = useRouter();
  return (
    <SupportScreen
      onOpenTicket={(id) => router.push({ pathname: '/aide/[id]', params: { id } })}
      onNewTicket={() => router.push('/aide/nouvelle')}
    />
  );
}
