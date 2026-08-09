import { useRouter } from 'expo-router';

import { ReceiptsScreen } from '@/features/receipts';

/**
 * L'accueil de TK LINK, c'est le portefeuille de tickets : ce que l'utilisateur
 * vient chercher en priorité, c'est son dernier ticket de caisse.
 */
export default function TicketsRoute() {
  const router = useRouter();
  return <ReceiptsScreen onOpenReceipt={(id) => router.push(`/ticket/${id}`)} />;
}
