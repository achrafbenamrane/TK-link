import { useMemo } from 'react';

import { TiersSettingsScreen } from '@/features/loyalty';
import { selectOffers, useMerchantStore } from '@/features/merchant';
import { getDeal, LOCAL_MERCHANT_DEAL_IDS, LOCAL_MERCHANT_ID } from '@/features/shop';

/**
 * Le barème de fidélité du commerçant — CDC §8.3.
 *
 * Route à part plutôt qu'un écran de plus dans l'espace commerçant : les
 * paliers appartiennent à la tranche `loyalty`, et une tranche n'importe pas sa
 * voisine. C'est la route qui les met à portée du commerçant — et qui lui
 * apporte ses produits, pour qu'il choisisse sa récompense dans sa propre
 * liste : ses offres du catalogue, puis celles qu'il a publiées lui-même.
 */
export default function TiersRoute() {
  const published = useMerchantStore(selectOffers);

  const products = useMemo(() => {
    const catalogue = LOCAL_MERCHANT_DEAL_IDS.flatMap((id) => {
      const deal = getDeal(id);
      return deal ? [{ id: deal.id, title: deal.title }] : [];
    });
    // Seules les offres destinées aux clients, publiées et toujours en ligne : un
    // brouillon ou un lot B2B n'est pas un produit qu'on offre en récompense.
    const own = published
      .filter((o) => o.state === 'publiee' && !o.offline && o.audience === 'clients')
      .map((o) => ({ id: `pub_${o.id}`, title: o.title }));
    return [...own, ...catalogue];
  }, [published]);

  return <TiersSettingsScreen merchantId={LOCAL_MERCHANT_ID} products={products} />;
}
