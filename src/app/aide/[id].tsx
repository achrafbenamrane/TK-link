import { useLocalSearchParams } from 'expo-router';

import { TicketScreen } from '@/features/support';

/** Une demande au support : la conversation avec l’équipe TK LINK. */
export default function TicketRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TicketScreen ticketId={id ?? ''} />;
}
