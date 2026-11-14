import { supabase } from '@/shared/lib/supabase';

import { fetchLiveFlashes } from '../lib/feed-api';
import { getDeal, getMerchant } from '../model/catalog';
import { liveDeal, liveMerchant, useLiveFeedStore, type LiveOffer } from '../model/live';

/**
 * Les Flash en direct, côté client : lues sur le serveur (requête et format), converties en offres
 * du catalogue, et retrouvées par `getDeal` / `getMerchant` comme n'importe quel exemple — c'est ce
 * qui fait marcher la fiche produit, le panier et la page du commerce sans rien changer d'autre.
 */
jest.mock('@/shared/lib/supabase', () => ({ supabase: { from: jest.fn() } }));
const from = supabase.from as jest.Mock;

const OFFER: LiveOffer = {
  id: 'f-1',
  shopId: 'shop-1',
  shopName: 'Le Petit Toulousain',
  area: 'Toulouse centre',
  lat: 43.5965,
  lng: 1.444,
  category: 'restauration',
  title: 'Plateau de viennoiseries',
  description: '',
  priceCents: 900,
  oldPriceCents: 1800,
  stockTotal: 6,
  stockLeft: 4,
  endsAt: Date.parse('2026-11-11T11:00:00Z'),
  modes: ['touch-collect'],
  photoUrl: 'https://cdn.example/p.jpg',
  shopRating: 0,
  shopRatingCount: 0,
};

beforeEach(() => {
  jest.clearAllMocks();
  useLiveFeedStore.setState({ offers: [] });
});

describe('fetchLiveFlashes', () => {
  it('ne demande que les Flash clients commencées, pas finies, avec du stock', async () => {
    const q: Record<string, jest.Mock> & { then?: unknown } = {};
    for (const m of ['select', 'eq', 'lte', 'gt', 'order', 'limit']) q[m] = jest.fn(() => q);
    q.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({
        data: [
          {
            id: 'f-1',
            title: 'Plateau de viennoiseries',
            category: 'restauration',
            description: '',
            price_cents: 900,
            old_price_cents: 1800,
            stock_total: 6,
            stock_left: 4,
            ends_at: '2026-11-11T11:00:00Z',
            modes: ['touch-collect'],
            photo_url: 'https://cdn.example/p.jpg',
            shop: {
              id: 'shop-1',
              name: 'Le Petit Toulousain',
              area: 'Toulouse centre',
              lat: 43.5965,
              lng: 1.444,
            },
          },
        ],
        error: null,
      }).then(resolve);
    from.mockReturnValueOnce(q);

    const res = await fetchLiveFlashes('2026-11-11T10:00:00Z');
    expect(res).toEqual({ ok: true, value: [OFFER] });
    expect(q.eq).toHaveBeenCalledWith('audience', 'clients');
    expect(q.lte).toHaveBeenCalledWith('starts_at', '2026-11-11T10:00:00Z');
    expect(q.gt).toHaveBeenCalledWith('ends_at', '2026-11-11T10:00:00Z');
    expect(q.gt).toHaveBeenCalledWith('stock_left', 0);
  });

  it('une réponse au mauvais format est écartée', async () => {
    const q: Record<string, jest.Mock> & { then?: unknown } = {};
    for (const m of ['select', 'eq', 'lte', 'gt', 'order', 'limit']) q[m] = jest.fn(() => q);
    q.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: [{ id: 'f-1' }], error: null }).then(resolve);
    from.mockReturnValueOnce(q);
    expect(await fetchLiveFlashes('2026-11-11T10:00:00Z')).toEqual({ ok: false });
  });
});

describe('une Flash en direct dans le catalogue', () => {
  it('devient une offre : prix en euros, compte à rebours depuis maintenant, photo, modes', () => {
    const deal = liveDeal(OFFER, Date.parse('2026-11-11T10:30:00Z'));
    expect(deal).toEqual(
      expect.objectContaining({
        id: 'f-1',
        merchantId: 'shop-1',
        price: 9,
        oldPrice: 18,
        endsInSeconds: 1800,
        imageUrl: 'https://cdn.example/p.jpg',
        fulfilments: ['touch-collect'],
        stockLeft: 4,
      }),
    );
    // Aucune note inventée tant qu'aucun avis n'existe.
    expect(deal.rating).toBe(0);
  });

  it('son commerce se place sur la carte, au centre de Toulouse s’il n’a pas été géocodé', () => {
    expect(liveMerchant(OFFER).coord).toEqual({ lat: 43.5965, lng: 1.444 });
    expect(liveMerchant({ ...OFFER, lat: null, lng: null }).coord).toEqual({
      lat: 43.6045,
      lng: 1.444,
    });
  });

  it('getDeal et getMerchant la retrouvent, comme un exemple', () => {
    expect(getDeal('f-1')).toBeUndefined();
    useLiveFeedStore.setState({ offers: [OFFER] });
    expect(getDeal('f-1')?.title).toBe('Plateau de viennoiseries');
    expect(getMerchant('shop-1')?.name).toBe('Le Petit Toulousain');
    // Les exemples restent prioritaires sur leur propre identifiant.
    expect(getDeal('d_cote')?.merchantId).not.toBe('shop-1');
  });
});
