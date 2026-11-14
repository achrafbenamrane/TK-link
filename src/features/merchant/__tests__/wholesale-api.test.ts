import { supabase } from '@/shared/lib/supabase';

import {
  advanceB2bOrder,
  fetchB2bPurchases,
  fetchB2bSales,
  fetchServerLots,
} from '../lib/wholesale-api';
import { B2B_STATUS_LABEL, nextB2bStep } from '../lib/wholesale-orders';

/**
 * Le B2B sur le serveur (migration 0023), contre un client Supabase SIMULÉ : le marché montre les
 * offres pro des autres grossistes avec leur nom, l'acheteur relit ses achats, le grossiste ses ventes
 * payées avec le nom du commerce acheteur, et il les fait avancer sans étape d'acceptation.
 */
jest.mock('@/shared/lib/supabase', () => ({
  supabase: { auth: { getSession: jest.fn() }, from: jest.fn(), rpc: jest.fn() },
}));

const getSession = supabase.auth.getSession as jest.Mock;
const from = supabase.from as jest.Mock;
const rpc = supabase.rpc as jest.Mock;

const NOW = Date.parse('2026-11-14T10:00:00Z');

/** Une chaîne PostgREST qui se termine sur `result` (maybeSingle, ou `await` direct). */
function chain(result: { data: unknown; error: unknown }) {
  const q: Record<string, jest.Mock> & { then?: unknown } = {};
  for (const m of ['select', 'eq', 'neq', 'not', 'in', 'lte', 'gt', 'order', 'limit']) {
    q[m] = jest.fn(() => q);
  }
  q.maybeSingle = jest.fn().mockResolvedValue(result);
  q.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return q;
}

const lot = (id: string, owner: string, name: string) => ({
  id,
  audience: 'commercants',
  title: 'Farine T65 (sac 25 kg)',
  category: 'restauration',
  description: '',
  price_cents: 1800,
  old_price_cents: 2400,
  stock_total: 500,
  stock_left: 350,
  min_qty: 10,
  duration_minutes: 1440,
  starts_at: '2026-11-14T08:00:00Z',
  modes: ['touch-collect', 'livraison'],
  photo_url: null,
  recurrence: 'aucune',
  offline: false,
  created_at: '2026-11-14T08:00:00Z',
  shops: { name, owner_id: owner },
});

const order = (o: Record<string, unknown> = {}) => ({
  id: 'o-1',
  customer_id: 'buyer-1',
  status: 'payee',
  fulfilment: 'livraison',
  total_cents: 270000,
  delivery_address: '8 rue des Carmes, 31000 Toulouse',
  created_at: '2026-11-14T09:00:00Z',
  shops: { name: 'Grossiste Occitan' },
  flash_order_items: [{ title: 'Farine T65 (sac 25 kg)', qty: 150, unit_price_cents: 1800 }],
  ...o,
});

beforeEach(() => {
  jest.clearAllMocks();
  getSession.mockResolvedValue({ data: { session: { user: { id: 'me' } } } });
});

describe('le marché des offres pro', () => {
  it('montre les offres des grossistes avec leur nom, sans les miennes', async () => {
    const q = chain({
      data: [lot('l-1', 'w-1', 'Grossiste Occitan'), lot('l-2', 'me', 'Mon commerce')],
      error: null,
    });
    from.mockReturnValue(q);
    const res = await fetchServerLots(NOW);
    expect(from).toHaveBeenCalledWith('flash_offers');
    expect(q.eq).toHaveBeenCalledWith('audience', 'commercants');
    expect(q.gt).toHaveBeenCalledWith('ends_at', '2026-11-14T10:00:00.000Z');
    expect(res.ok && res.value.map((l) => [l.id, l.seller, l.minQty])).toEqual([
      ['l-1', 'Grossiste Occitan', 10],
    ]);
  });

  it('demande une session', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    expect(await fetchServerLots(NOW)).toEqual({ ok: false, code: 'not_signed_in' });
  });

  it('rejette une réponse illisible plutôt que de montrer un lot faux', async () => {
    from.mockReturnValue(chain({ data: [{ id: 'l-1' }], error: null }));
    expect(await fetchServerLots(NOW)).toEqual({ ok: false, code: 'unknown' });
  });
});

describe('les achats du commerçant', () => {
  it('relit ses commandes B2B avec le nom du grossiste', async () => {
    const q = chain({ data: [order({ status: 'paiement_attente' })], error: null });
    from.mockReturnValue(q);
    const res = await fetchB2bPurchases();
    expect(q.eq).toHaveBeenCalledWith('customer_id', 'me');
    expect(q.eq).toHaveBeenCalledWith('audience', 'commercants');
    expect(res).toEqual({
      ok: true,
      value: [
        {
          id: 'o-1',
          status: 'paiement_attente',
          fulfilment: 'livraison',
          title: 'Farine T65 (sac 25 kg)',
          qty: 150,
          totalCents: 270000,
          counterpart: 'Grossiste Occitan',
          address: '8 rue des Carmes, 31000 Toulouse',
          at: Date.parse('2026-11-14T09:00:00Z'),
        },
      ],
    });
  });
});

describe('les ventes du grossiste', () => {
  it('lit ses ventes payées, avec le nom du commerce acheteur', async () => {
    const shop = chain({ data: { id: 'shop-w', status: 'valide' }, error: null });
    const sales = chain({ data: [order()], error: null });
    const buyers = chain({
      data: [{ owner_id: 'buyer-1', name: 'Le Petit Toulousain' }],
      error: null,
    });
    from.mockReturnValueOnce(shop).mockReturnValueOnce(sales).mockReturnValueOnce(buyers);
    const res = await fetchB2bSales();
    expect(sales.eq).toHaveBeenCalledWith('shop_id', 'shop-w');
    expect(sales.not).toHaveBeenCalledWith('status', 'in', '(paiement_attente,annulee)');
    expect(buyers.in).toHaveBeenCalledWith('owner_id', ['buyer-1']);
    expect(res.ok && res.value[0]?.counterpart).toBe('Le Petit Toulousain');
  });

  it('rien à lire tant que l’entreprise n’est pas validée', async () => {
    from.mockReturnValue(chain({ data: { id: 'shop-w', status: 'en_verification' }, error: null }));
    expect(await fetchB2bSales()).toEqual({ ok: true, value: [] });
  });

  it('fait avancer une vente par le serveur', async () => {
    rpc.mockResolvedValue({ error: null });
    expect(await advanceB2bOrder('o-1', 'en_livraison')).toEqual({ ok: true, value: null });
    expect(rpc).toHaveBeenCalledWith('advance_order', { p_order: 'o-1', p_status: 'en_livraison' });
  });
});

describe('le prochain geste du grossiste', () => {
  it('sans acceptation : payée, on prépare ; livrée par lui : expédiée, puis livrée', () => {
    expect(nextB2bStep({ status: 'payee', fulfilment: 'livraison' })).toMatchObject({
      to: 'preparation',
    });
    expect(nextB2bStep({ status: 'preparation', fulfilment: 'livraison' })).toMatchObject({
      to: 'en_livraison',
      label: 'Marquer expédiée',
    });
    expect(nextB2bStep({ status: 'en_livraison', fulfilment: 'livraison' })).toMatchObject({
      to: 'livree',
    });
    expect(nextB2bStep({ status: 'livree', fulfilment: 'livraison' })).toBeNull();
  });

  it('retrait chez lui : prête, puis remise contre le code', () => {
    expect(nextB2bStep({ status: 'preparation', fulfilment: 'touch-collect' })).toMatchObject({
      to: 'prete',
    });
    expect(nextB2bStep({ status: 'prete', fulfilment: 'touch-collect' })).toEqual({
      kind: 'handover',
      label: 'Remettre la commande',
    });
  });

  it('dit « Expédiée » et non « En livraison » à un commerçant', () => {
    expect(B2B_STATUS_LABEL.en_livraison).toBe('Expédiée');
    expect(B2B_STATUS_LABEL.payee).toBe('Commande reçue');
  });
});
