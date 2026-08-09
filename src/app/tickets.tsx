import { useRouter } from 'expo-router';

import { ReceiptsScreen } from '@/features/receipts';

/**
 * MES TICKETS — le portefeuille dématérialisé TK LINK.
 *
 * Il vit hors des onglets : la maquette du client garde ses cinq entrées
 * (Accueil, Favoris, Parcourir, Commandes, Compte). On y accède depuis le
 * compte, comme les factures.
 */
export default function TicketsRoute() {
  const router = useRouter();
  return <ReceiptsScreen onOpenReceipt={(id) => router.push(`/ticket/${id}`)} />;
}
