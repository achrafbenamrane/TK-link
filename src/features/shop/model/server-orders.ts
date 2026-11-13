import { create } from 'zustand';

import { CATEGORY_INFO } from '@/shared/lib/categories';

import {
  fetchMyOrders,
  fetchShopOrders,
  type OrdersError,
  type ServerOrder,
} from '../lib/orders-api';
import { findLiveOffer } from './live';

/**
 * LES COMMANDES DU SERVEUR, relues à la demande (onglet Commandes, fiche de commande, écran du
 * commerçant). Le serveur fait foi : ce magasin n’en garde qu’une copie lue, jamais persistée — une
 * commande périmée sur le disque mentirait sur son statut.
 *
 * - `mine` : celles que j’ai passées (acheteur).
 * - `shop` : celles que mon commerce a reçues (commerçant), payées seulement.
 */
type ServerOrdersState = {
  mine: ServerOrder[];
  shop: ServerOrder[];
  mineError: OrdersError | null;
  shopError: OrdersError | null;
  refreshMine: () => Promise<void>;
  refreshShop: () => Promise<void>;
};

/** L’emoji de l’offre si elle est encore dans le flux en direct, sinon un sac. */
export function emojiOfOffer(offerId: string): string {
  const offer = findLiveOffer(offerId);
  return offer ? CATEGORY_INFO[offer.category].emoji : '🛍️';
}

export const useServerOrdersStore = create<ServerOrdersState>()((set) => ({
  mine: [],
  shop: [],
  mineError: null,
  shopError: null,

  refreshMine: async () => {
    const res = await fetchMyOrders(emojiOfOffer);
    // Hors ligne : on garde la dernière lecture plutôt que de vider l’écran.
    if (res.ok) set({ mine: res.value, mineError: null });
    else set({ mineError: res.code });
  },

  refreshShop: async () => {
    const res = await fetchShopOrders(emojiOfOffer);
    if (res.ok) set({ shop: res.value, shopError: null });
    else set({ shopError: res.code });
  },
}));

export const selectMyServerOrders = (s: ServerOrdersState) => s.mine;
export const selectShopServerOrders = (s: ServerOrdersState) => s.shop;

/** Une commande du serveur par son identifiant, côté acheteur ou côté commerçant. */
export function findServerOrder(id: string): ServerOrder | undefined {
  const { mine, shop } = useServerOrdersStore.getState();
  return mine.find((o) => o.id === id) ?? shop.find((o) => o.id === id);
}
