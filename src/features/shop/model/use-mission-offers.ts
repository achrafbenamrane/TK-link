import { useMemo } from 'react';

import { missionOffers } from '../lib/missions';
import { selectOrders, useShopStore } from './store';

/**
 * Les missions que les commandes prêtes en livraison proposent aux livreurs.
 *
 * Un hook plutôt qu'un sélecteur : `missionOffers` fabrique un tableau neuf, et un sélecteur
 * Zustand qui renverrait un tableau neuf à chaque rendu boucle à l'infini. On sélectionne donc
 * les tranches brutes (commandes, adresses) et on mémorise la conversion.
 */
export function useMissionOffers() {
  const orders = useShopStore(selectOrders);
  const addresses = useShopStore((s) => s.addresses);
  return useMemo(() => missionOffers(orders, addresses), [orders, addresses]);
}
