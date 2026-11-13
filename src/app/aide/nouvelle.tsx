import { useLocalSearchParams, useRouter } from 'expo-router';

import { NewTicketScreen, TICKET_CATEGORIES, type TicketCategory } from '@/features/support';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Nouvelle demande au support. `?commande=<id>` la rattache à une commande du serveur. */
export default function NewTicketRoute() {
  const router = useRouter();
  const { commande, sujet } = useLocalSearchParams<{ commande?: string; sujet?: string }>();
  const orderId = commande && UUID.test(commande) ? commande : null;
  const category = (TICKET_CATEGORIES as readonly string[]).includes(sujet ?? '')
    ? (sujet as TicketCategory)
    : undefined;
  return (
    <NewTicketScreen
      orderId={orderId}
      {...(category ? { initialCategory: category } : {})}
      onCreated={(id) => router.replace({ pathname: '/aide/[id]', params: { id } })}
    />
  );
}
