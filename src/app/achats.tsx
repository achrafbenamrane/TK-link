import { useRouter } from 'expo-router';

import { MerchantPurchasesScreen } from '@/features/merchant';
import { isSupabaseConfigured } from '@/shared/lib/env';

/**
 * Les commandes passées aux grossistes (B2B) — V1.1 : « consultation et commande
 * des offres B2B via l'onglet grossiste ». Elles ne sont plus l'onglet
 * « Commandes » du commerçant, qui est celui de ses VENTES.
 *
 * Avec un serveur (migration 0023) : les vrais achats ; une réservation à payer ou une commande prête
 * au retrait s'ouvre sur la fiche de commande (feature `shop`), qui sait payer et montrer le code.
 */
export default function AchatsRoute() {
  const router = useRouter();
  return (
    <MerchantPurchasesScreen
      server={isSupabaseConfigured}
      onOpenOrder={(id) => router.push({ pathname: '/commande/[id]', params: { id } })}
    />
  );
}
