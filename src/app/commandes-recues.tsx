import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import { selectOffers, useMerchantStore } from '@/features/merchant';
import { MerchantOrdersScreen } from '@/features/shop';

/**
 * LES COMMANDES REÇUES — CDC §11 et §18.
 *
 * La route croise les deux features : `merchant` sait ce que j'ai publié,
 * `shop` sait ce qui a été commandé. Le préfixe `pub_` est la convention posée
 * par l'accueil quand il convertit une publication en fiche produit — c'est le
 * seul endroit qui connaît les deux formats, donc le seul qui peut faire le
 * rapprochement.
 */
export default function CommandesRecuesRoute() {
  const router = useRouter();
  const published = useMerchantStore(selectOffers);

  const dealIds = useMemo(() => published.map((o) => `pub_${o.id}`), [published]);

  return <MerchantOrdersScreen dealIds={dealIds} onBack={() => router.back()} />;
}
