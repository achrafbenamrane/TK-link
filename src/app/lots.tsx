import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { WholesaleScreen } from '@/features/merchant';
import { selectRole, selectSiret, useOnboardingStore } from '@/features/onboarding';
import { CHECKOUT_ERROR, openPaymentPage, prepareServerCheckout } from '@/features/shop';
import { isSupabaseConfigured } from '@/shared/lib/env';
import { WHOLESALE_BLOCK_MESSAGE, wholesaleOrderBlock } from '@/shared/lib/roles';

/**
 * LE MARCHÉ B2B — CDC §20, gardé par le §5.
 *
 * La route croise le profil (rôle + SIRET, feature `onboarding`) avec le
 * marché (feature `merchant`). Le CDC est catégorique : « un commerçant ne
 * doit pas pouvoir passer une commande auprès d'un grossiste sans avoir
 * renseigné son SIRET ». La règle vit dans `shared/lib/roles`, testée à part ;
 * ici on ne fait que la brancher.
 *
 * Avec un serveur (migration 0023), la caisse est celle des clients (feature `shop`) : réserver,
 * puis payer sur la page Stripe — sans devis Uber, le grossiste livre lui-même.
 */
export default function LotsRoute() {
  const router = useRouter();
  const role = useOnboardingStore(selectRole);
  const siret = useOnboardingStore(selectSiret);

  const block = wholesaleOrderBlock(role, siret);

  const checkout = useCallback(
    async (input: { offerId: string; qty: number; fulfilment: 'touch-collect' | 'livraison' }) => {
      const res = await prepareServerCheckout({
        lines: [{ offerId: input.offerId, qty: input.qty }],
        fulfilment: input.fulfilment,
        courier: false,
      });
      if (!res.ok) return CHECKOUT_ERROR[res.code];
      await openPaymentPage(res.paymentUrl);
      return null;
    },
    [],
  );

  return (
    <WholesaleScreen
      checkout={isSupabaseConfigured ? checkout : undefined}
      onPurchases={() => router.push('/achats')}
      blockedReason={block ? WHOLESALE_BLOCK_MESSAGE[block] : null}
      // Un SIRET manquant se répare en trente secondes : on y mène.
      onFixProfile={block === 'siret' ? () => router.push('/sign-up') : undefined}
      onBack={() => router.back()}
    />
  );
}
