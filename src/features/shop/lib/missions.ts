import { getDeal, getMerchant } from '../model/catalog';
import type { Address, Order } from '../model/schema';
import { POSITION_ADDRESS_ID, POSITION_LABEL } from './destination';

/**
 * Une offre de mission pour un livreur — fabriquée à partir d'une commande en
 * LIVRAISON que le commerçant a marquée « prête » (CDC V1.1 : « la course commence
 * après l'achat verrouillé »).
 *
 * La forme est volontairement générique : la feature `courier` définit sa propre
 * `Mission` et ne connaît ni les commandes ni le catalogue — c'est la route qui
 * les met en relation.
 *
 * `distanceKm` reste `null` : une adresse de livraison n'a pas de coordonnées
 * ici, et on n'invente pas de kilomètres.
 */
export type MissionOffer = {
  orderId: string;
  merchantName: string;
  merchantArea: string;
  dropoff: string;
  itemCount: number;
  totalEur: number;
  distanceKm: number | null;
};

export function missionOffers(orders: Order[], addresses: Address[]): MissionOffer[] {
  return orders
    .filter((o) => o.fulfilment === 'livraison' && o.status === 'prete')
    .map((o) => {
      const first = o.items[0] ? getDeal(o.items[0].dealId) : undefined;
      const merchant = first ? getMerchant(first.merchantId) : undefined;
      const address = addresses.find((a) => a.id === o.addressId);
      // Livraison à la position du client : on affiche le libellé, jamais les
      // coordonnées brutes. La distance reste inconnue (une ligne droite
      // sous-estimerait le trajet, donc le gain du livreur).
      const dropoff =
        o.addressId === POSITION_ADDRESS_ID
          ? POSITION_LABEL
          : address
            ? `${address.street}, ${address.zip} ${address.city}`
            : '';
      return {
        orderId: o.id,
        merchantName: merchant?.name ?? 'Commerçant',
        merchantArea: merchant?.area ?? '',
        dropoff,
        itemCount: o.items.reduce((n, l) => n + l.qty, 0),
        totalEur: o.total,
        distanceKm: null,
      };
    });
}
