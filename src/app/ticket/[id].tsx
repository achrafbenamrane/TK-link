import { useLocalSearchParams, useRouter } from 'expo-router';

import { ReceiptDetailScreen } from '@/features/receipts';

/** Le détail d'un ticket — et sa transformation en facture certifiée. */
export default function TicketDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  return (
    <ReceiptDetailScreen
      id={id ?? ''}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
    />
  );
}
