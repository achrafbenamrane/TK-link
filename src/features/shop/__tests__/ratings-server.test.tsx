import { supabase } from '@/shared/lib/supabase';
import { act, fireEvent, render, screen, waitFor } from '@/shared/testing/render';

import { ratingSummary } from '../lib/rating';
import {
  classifyRatingError,
  fetchMyRating,
  fetchShopRatings,
  rateServerOrder,
} from '../lib/ratings-api';
import { useLiveFeedStore } from '../model/live';
import { ServerRateMerchant } from '../ui/components/server-rating';

/**
 * Noter le commerçant SUR LE SERVEUR (migration 0025), contre un client Supabase simulé : la note
 * part par `rate_order`, chacun relit la sienne, la moyenne publique arrive sur les offres du fil
 * (« 4,6 · 12 avis »), et sans 0025 rien ne casse — la note ne s'affiche pas.
 */
jest.mock('@/shared/lib/env', () => ({
  ...jest.requireActual('@/shared/lib/env'),
  isSupabaseConfigured: true,
}));
jest.mock('@/shared/lib/supabase', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn() },
}));

const from = supabase.from as jest.Mock;
const rpc = supabase.rpc as jest.Mock;

function chain(result: { data: unknown; error: unknown }) {
  const q: Record<string, jest.Mock> & { then?: unknown } = {};
  for (const m of ['select', 'eq', 'in', 'gt', 'lte', 'order', 'limit']) q[m] = jest.fn(() => q);
  q.maybeSingle = jest.fn().mockResolvedValue(result);
  q.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return q;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ratingSummary — ce que la vitrine affiche', () => {
  it('une décimale à la française, et le nombre d’avis', () => {
    expect(ratingSummary(4.6, 12)).toBe('4,6 · 12 avis');
    expect(ratingSummary(5)).toBe('5,0');
  });
  it('pas de note : rien (la vitrine dit « Nouveau »), jamais « 0 »', () => {
    expect(ratingSummary(0, 0)).toBeNull();
    expect(ratingSummary(Number.NaN)).toBeNull();
  });
});

describe('ratings-api', () => {
  it('envoie la note par rate_order', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(rateServerOrder('o-1', 4, ['Rapide'])).resolves.toEqual({ ok: true, value: null });
    expect(rpc).toHaveBeenCalledWith('rate_order', {
      p_order: 'o-1',
      p_stars: 4,
      p_tags: ['Rapide'],
    });
  });

  it('les refus du serveur gardent leur nom', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'already_rated' } });
    await expect(rateServerOrder('o-1', 4, [])).resolves.toEqual({
      ok: false,
      code: 'already_rated',
    });
    expect(classifyRatingError({ message: 'not_finished' })).toBe('not_finished');
    expect(classifyRatingError({ message: 'not_authenticated' })).toBe('not_signed_in');
    // 0025 pas encore appliquée : « indisponible », pas une erreur à montrer.
    expect(classifyRatingError({ code: 'PGRST202', message: 'Could not find the function' })).toBe(
      'unavailable',
    );
    expect(classifyRatingError({ code: 'PGRST205', message: 'Could not find the table' })).toBe(
      'unavailable',
    );
  });

  it('relit sa propre note', async () => {
    from.mockReturnValue(
      chain({
        data: { stars: 5, tags: ['Rapide'], created_at: '2026-11-14T10:00:00Z' },
        error: null,
      }),
    );
    const res = await fetchMyRating('o-1');
    expect(from).toHaveBeenCalledWith('order_ratings');
    expect(res).toEqual({
      ok: true,
      value: { stars: 5, tags: ['Rapide'], at: Date.parse('2026-11-14T10:00:00Z') },
    });
  });

  it('les moyennes : une par commerce, et jamais d’échec (sans 0025 : aucune)', async () => {
    rpc.mockResolvedValueOnce({
      data: [{ shop_id: 's-1', average: '4.6', count: 12 }],
      error: null,
    });
    await expect(fetchShopRatings(['s-1', 's-1', 's-2'])).resolves.toEqual({
      's-1': { average: 4.6, count: 12 },
    });
    expect(rpc).toHaveBeenCalledWith('shop_ratings', { p_shops: ['s-1', 's-2'] });
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'missing' } });
    await expect(fetchShopRatings(['s-1'])).resolves.toEqual({});
  });
});

describe('le fil : la vraie moyenne sur les offres du serveur', () => {
  it('fusionne les moyennes dans les offres ; un commerce sans note reste à 0', async () => {
    const row = (id: string, shop: string) => ({
      id,
      title: 'Panier',
      category: 'restauration',
      description: '',
      price_cents: 450,
      old_price_cents: 1100,
      stock_total: 10,
      stock_left: 4,
      ends_at: '2099-01-01T00:00:00Z',
      modes: ['touch-collect'],
      photo_url: null,
      shop: { id: shop, name: `Commerce ${shop}`, area: 'Capitole', lat: null, lng: null },
    });
    from.mockReturnValue(chain({ data: [row('f-1', 's-1'), row('f-2', 's-2')], error: null }));
    rpc.mockResolvedValue({ data: [{ shop_id: 's-1', average: 4.6, count: 12 }], error: null });

    await act(async () => {
      await useLiveFeedStore.getState().refresh();
    });
    const offers = useLiveFeedStore.getState().offers;
    expect(offers.find((o) => o.shopId === 's-1')).toMatchObject({
      shopRating: 4.6,
      shopRatingCount: 12,
    });
    expect(offers.find((o) => o.shopId === 's-2')).toMatchObject({
      shopRating: 0,
      shopRatingCount: 0,
    });
  });
});

describe('<ServerRateMerchant />', () => {
  it('commande terminée, pas encore notée : on note, la note part au serveur', async () => {
    from.mockReturnValue(chain({ data: null, error: null }));
    rpc.mockResolvedValue({ data: null, error: null });
    render(<ServerRateMerchant orderId="o-1" status="livree" merchantName="Le Comptoir" />);

    expect(await screen.findByTestId('order-rating')).toBeTruthy();
    fireEvent.press(screen.getByTestId('rating-star-4'));
    fireEvent.press(screen.getByTestId('rating-tag-Produit frais'));
    fireEvent.press(screen.getByTestId('rating-submit'));

    expect(await screen.findByTestId('order-rating-done')).toHaveTextContent(/4\/5/);
    expect(rpc).toHaveBeenCalledWith('rate_order', {
      p_order: 'o-1',
      p_stars: 4,
      p_tags: ['Produit frais'],
    });
  });

  it('déjà notée : le merci, avec la note relue', async () => {
    from.mockReturnValue(
      chain({ data: { stars: 3, tags: [], created_at: '2026-11-14T10:00:00Z' }, error: null }),
    );
    render(<ServerRateMerchant orderId="o-1" status="recuperee" merchantName="Le Comptoir" />);
    expect(await screen.findByTestId('order-rating-done')).toHaveTextContent(/3\/5/);
  });

  it('pas terminée : rien à noter (et rien n’est demandé au serveur)', () => {
    render(<ServerRateMerchant orderId="o-1" status="preparation" merchantName="Le Comptoir" />);
    expect(screen.queryByTestId('order-rating')).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it('serveur sans la notation (0025 absente) : rien ne s’affiche', async () => {
    from.mockReturnValue(
      chain({ data: null, error: { code: 'PGRST205', message: 'Could not find the table' } }),
    );
    render(<ServerRateMerchant orderId="o-1" status="livree" merchantName="Le Comptoir" />);
    await waitFor(() => expect(from).toHaveBeenCalled());
    expect(screen.queryByTestId('order-rating')).toBeNull();
    expect(screen.queryByTestId('order-rating-done')).toBeNull();
  });

  it('un refus s’explique, et le formulaire reste', async () => {
    from.mockReturnValue(chain({ data: null, error: null }));
    rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'not_finished' } });
    render(<ServerRateMerchant orderId="o-1" status="livree" merchantName="Le Comptoir" />);
    fireEvent.press(await screen.findByTestId('rating-star-5'));
    fireEvent.press(screen.getByTestId('rating-submit'));
    expect(await screen.findByTestId('rating-error')).toHaveTextContent(/une fois la commande/);
    expect(screen.getByTestId('order-rating')).toBeTruthy();
  });
});
