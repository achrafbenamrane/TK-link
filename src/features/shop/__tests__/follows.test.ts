import { supabase } from '@/shared/lib/supabase';

import { fetchFollowedShops, followShop, unfollowShop } from '../lib/follows-api';
import { useFollowsStore } from '../model/follows';

/**
 * Suivre un commerce (migration 0026), contre un client Supabase simulé : l'abonnement part au
 * serveur, s'annule à l'écran s'il est refusé, (la notification, elle, est testée dans
 * notifications).
 */
jest.mock('@/shared/lib/env', () => ({
  ...jest.requireActual('@/shared/lib/env'),
  isSupabaseConfigured: true,
}));
jest.mock('@/shared/lib/supabase', () => ({
  supabase: { auth: { getSession: jest.fn() }, from: jest.fn() },
}));

const from = supabase.from as jest.Mock;
const getSession = supabase.auth.getSession as jest.Mock;

const SHOP = '22222222-2222-4222-8222-222222222222';

function table(result: { data?: unknown; error: unknown }) {
  const q: Record<string, jest.Mock> & { then?: unknown } = {};
  for (const m of ['select', 'order', 'eq', 'delete']) q[m] = jest.fn(() => q);
  q.insert = jest.fn().mockResolvedValue(result);
  q.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return q;
}

beforeEach(() => {
  jest.clearAllMocks();
  getSession.mockResolvedValue({ data: { session: { user: { id: 'u-1' } } } });
  useFollowsStore.setState({ shops: [], loaded: false });
});

describe('follows-api', () => {
  it('suivre : une ligne au nom de l’utilisateur connecté', async () => {
    const q = table({ error: null });
    from.mockReturnValue(q);
    await expect(followShop(SHOP)).resolves.toEqual({ ok: true, value: null });
    expect(from).toHaveBeenCalledWith('shop_follows');
    expect(q.insert).toHaveBeenCalledWith({ user_id: 'u-1', shop_id: SHOP });
  });

  it('déjà suivi (autre téléphone, double appui) : c’est le résultat voulu', async () => {
    from.mockReturnValue(table({ error: { code: '23505', message: 'duplicate key' } }));
    await expect(followShop(SHOP)).resolves.toEqual({ ok: true, value: null });
  });

  it('ne plus suivre : retire la ligne du commerce', async () => {
    const q = table({ error: null });
    from.mockReturnValue(q);
    await expect(unfollowShop(SHOP)).resolves.toEqual({ ok: true, value: null });
    expect(q.delete).toHaveBeenCalled();
    expect(q.eq).toHaveBeenCalledWith('shop_id', SHOP);
  });

  it('relit ses abonnements avec le nom des commerces', async () => {
    from.mockReturnValue(
      table({
        data: [
          { shop_id: SHOP, shop: { name: 'Boulangerie Saint-Cyprien', area: 'Saint-Cyprien' } },
        ],
        error: null,
      }),
    );
    await expect(fetchFollowedShops()).resolves.toEqual({
      ok: true,
      value: [{ shopId: SHOP, name: 'Boulangerie Saint-Cyprien', area: 'Saint-Cyprien' }],
    });
  });

  it('serveur sans 0026 : « pas encore ouvert », pas une panne', async () => {
    from.mockReturnValue(table({ data: null, error: { code: 'PGRST205', message: 'missing' } }));
    await expect(fetchFollowedShops()).resolves.toEqual({ ok: false, code: 'unavailable' });
  });
});

describe('useFollowsStore', () => {
  const shop = { shopId: SHOP, name: 'Boulangerie Saint-Cyprien', area: 'Saint-Cyprien' };

  it('suit tout de suite à l’écran, et garde l’abonnement quand le serveur accepte', async () => {
    from.mockReturnValue(table({ error: null }));
    const res = await useFollowsStore.getState().toggle(shop);
    expect(res).toEqual({ ok: true });
    expect(useFollowsStore.getState().shops).toEqual([shop]);
  });

  it('refusé par le serveur : l’écran revient en arrière, avec la raison', async () => {
    from.mockReturnValue(table({ error: { code: 'PGRST205', message: 'missing' } }));
    const res = await useFollowsStore.getState().toggle(shop);
    expect(res).toEqual({ ok: false, code: 'unavailable' });
    expect(useFollowsStore.getState().shops).toEqual([]);
  });

  it('à la déconnexion, le compte suivant n’hérite de rien', () => {
    useFollowsStore.setState({ shops: [shop], loaded: true });
    useFollowsStore.getState().reset();
    expect(useFollowsStore.getState()).toMatchObject({ shops: [], loaded: false });
  });
});
