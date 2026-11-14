import { create } from 'zustand';

import {
  type FollowError,
  type FollowedShop,
  fetchFollowedShops,
  followShop,
  unfollowShop,
} from '../lib/follows-api';

/** Un commerce du serveur (sinon un exemple de la démonstration, suivi sur le téléphone seulement). */
const SERVER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type FollowsState = {
  /** Les commerces suivis, du plus récent au plus ancien. */
  shops: FollowedShop[];
  /** Relus au serveur depuis le lancement (sinon : à relire avant de se fier à `shops`). */
  loaded: boolean;
  refresh: () => Promise<void>;
  /** Suivre ou ne plus suivre ; affiché tout de suite, annulé si le serveur refuse. */
  toggle: (shop: FollowedShop) => Promise<{ ok: true } | { ok: false; code: FollowError }>;
  /** À la déconnexion : le compte suivant n'hérite de rien. */
  reset: () => void;
};

/**
 * Les commerces suivis (0026). Rien n'est gardé sur le téléphone : la liste se relit au serveur à
 * chaque lancement — un autre compte connecté sur le même appareil ne voit pas celle du précédent.
 */
export const useFollowsStore = create<FollowsState>()((set, get) => ({
  shops: [],
  loaded: false,
  refresh: async () => {
    const res = await fetchFollowedShops();
    if (!res.ok) return;
    // Les exemples de la démonstration suivis sur ce téléphone restent dans la liste.
    const local = get().shops.filter((s) => !SERVER_ID.test(s.shopId));
    set({ shops: [...res.value, ...local], loaded: true });
  },
  toggle: async (shop) => {
    const before = get().shops;
    const following = before.some((s) => s.shopId === shop.shopId);
    set({
      shops: following ? before.filter((s) => s.shopId !== shop.shopId) : [shop, ...before],
    });
    if (!SERVER_ID.test(shop.shopId)) return { ok: true };
    const res = following ? await unfollowShop(shop.shopId) : await followShop(shop.shopId);
    if (res.ok) return { ok: true };
    set({ shops: before });
    return { ok: false, code: res.code };
  },
  reset: () => set({ shops: [], loaded: false }),
}));

export const selectFollowedShops = (s: FollowsState) => s.shops;
