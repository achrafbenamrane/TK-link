import { openAuthSessionAsync } from 'expo-web-browser';

import { fireEvent, render, screen, waitFor } from '@/shared/testing/render';

import { callEdge } from '@/shared/lib/edge';
import { supabase } from '@/shared/lib/supabase';

import { cancelOrder, classifyOrdersError, toServerOrder } from '../lib/orders-api';
import { prepareServerCheckout } from '../lib/server-checkout';
import { useServerOrdersStore } from '../model/server-orders';
import { pickupPayload } from '../lib/pickup';
import { ServerOrderPanel } from '../ui/components/server-order-panel';

/**
 * La commande sur le serveur, côté client (rapport d’avancement du 13/11/2026) : réserver, payer
 * sur la page Stripe, suivre, retirer avec un code. Le serveur et Stripe sont simulés.
 */
const mockServer = { configured: true };
jest.mock('@/shared/lib/env', () =>
  Object.defineProperty({ ...jest.requireActual('@/shared/lib/env') }, 'isSupabaseConfigured', {
    enumerable: true,
    get: () => mockServer.configured,
  }),
);
jest.mock('@/shared/lib/edge', () => ({ callEdge: jest.fn() }));
jest.mock('@/shared/lib/supabase', () => ({
  supabase: { auth: { getSession: jest.fn() }, from: jest.fn(), rpc: jest.fn() },
}));
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn(async () => ({})) }));

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: mockPush,
    back: jest.fn(),
    canGoBack: () => true,
  }),
  useLocalSearchParams: () => ({}),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- why: une fabrique de jest.mock ne capture pas un import
  useFocusEffect: (effect: () => void) => require('react').useEffect(effect, [effect]),
}));

const rpc = supabase.rpc as unknown as jest.Mock;
const edge = callEdge as jest.Mock;
const browser = openAuthSessionAsync as jest.Mock;

const ORDER_ID = '22222222-2222-4222-8222-222222222222';
const OFFER_ID = '33333333-3333-4333-8333-333333333333';

const row = (o: Record<string, unknown> = {}) => ({
  id: ORDER_ID,
  shop_id: 'shop-1',
  fulfilment: 'touch-collect',
  status: 'payee',
  subtotal_cents: 400,
  discount_cents: 0,
  delivery_fee_cents: 0,
  total_cents: 400,
  delivery_address: null,
  delivery_lat: null,
  delivery_lng: null,
  reserved_until: '2026-11-13T18:15:00Z',
  uber_tracking_url: null,
  created_at: '2026-11-13T18:00:00Z',
  flash_order_items: [{ offer_id: OFFER_ID, title: 'Brioche', qty: 2, unit_price_cents: 200 }],
  ...o,
});

beforeEach(() => {
  rpc.mockReset();
  edge.mockReset();
  browser.mockClear();
  mockReplace.mockClear();
  mockPush.mockClear();
  mockServer.configured = true;
});

describe('conversion et erreurs', () => {
  it('une commande du serveur devient une commande de l’app, suivie par le serveur', () => {
    const order = toServerOrder(row() as never, () => '🥐');
    expect(order).toMatchObject({
      id: ORDER_ID,
      status: 'payee',
      managed: true,
      total: 4,
      deliveryFee: 0,
      pointsEarned: 4,
      items: [{ dealId: OFFER_ID, title: 'Brioche', emoji: '🥐', qty: 2, price: 2 }],
    });
  });

  it('reconnaît les refus du serveur, levés par les fonctions SQL ou Edge', () => {
    expect(classifyOrdersError({ code: 'P0001', message: 'out_of_stock' })).toBe('out_of_stock');
    expect(classifyOrdersError('shop_cannot_be_paid')).toBe('shop_cannot_be_paid');
    expect(classifyOrdersError('stripe_not_configured')).toBe('service_unavailable');
    expect(classifyOrdersError({ code: 'PGRST202', message: 'Could not find the function' })).toBe(
      'service_unavailable',
    );
    expect(classifyOrdersError('offline')).toBe('network');
  });
});

describe('passage en caisse', () => {
  const input = { lines: [{ offerId: OFFER_ID, qty: 2 }], fulfilment: 'livraison' as const };

  it('réserve, chiffre la livraison, puis ouvre la page de paiement', async () => {
    rpc.mockResolvedValueOnce({ data: ORDER_ID, error: null });
    edge
      .mockResolvedValueOnce({ ok: true, data: { feeCents: 599, totalCents: 999 } })
      .mockResolvedValueOnce({ ok: true, data: { url: 'https://checkout.stripe.com/c/pay/x' } });

    expect(
      await prepareServerCheckout({ ...input, address: '8 rue des Carmes, 31000 Toulouse' }),
    ).toEqual({ ok: true, orderId: ORDER_ID, paymentUrl: 'https://checkout.stripe.com/c/pay/x' });
    expect(rpc).toHaveBeenCalledWith(
      'reserve_flash',
      expect.objectContaining({
        p_items: [{ offer_id: OFFER_ID, qty: 2 }],
        p_fulfilment: 'livraison',
        p_address: '8 rue des Carmes, 31000 Toulouse',
      }),
    );
    expect(edge).toHaveBeenNthCalledWith(1, 'uber-quote', { orderId: ORDER_ID });
    expect(edge).toHaveBeenNthCalledWith(2, 'stripe-payment', { orderId: ORDER_ID });
  });

  it('le paiement pas encore activé : la réservation est annulée, le stock revient', async () => {
    rpc
      .mockResolvedValueOnce({ data: ORDER_ID, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    edge.mockResolvedValueOnce({ ok: false, code: 'stripe_not_configured', status: 503 });

    expect(await prepareServerCheckout({ ...input, fulfilment: 'touch-collect' })).toEqual({
      ok: false,
      code: 'service_unavailable',
    });
    expect(rpc).toHaveBeenLastCalledWith('cancel_order', { p_order: ORDER_ID });
  });

  it('stock épuisé : rien n’est réservé, rien n’est payé', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'P0001', message: 'out_of_stock' } });
    expect(await prepareServerCheckout(input)).toEqual({ ok: false, code: 'out_of_stock' });
    expect(edge).not.toHaveBeenCalled();
  });

  it('offre pro livrée par le grossiste (0023) : pas de devis Uber, droit au paiement', async () => {
    rpc.mockResolvedValueOnce({ data: ORDER_ID, error: null });
    edge.mockResolvedValueOnce({ ok: true, data: { url: 'https://checkout.stripe.com/c/pay/y' } });
    expect(await prepareServerCheckout({ ...input, courier: false })).toEqual({
      ok: true,
      orderId: ORDER_ID,
      paymentUrl: 'https://checkout.stripe.com/c/pay/y',
    });
    expect(edge).toHaveBeenCalledTimes(1);
    expect(edge).toHaveBeenCalledWith('stripe-payment', { orderId: ORDER_ID });
  });

  it('offre pro : les refus du serveur se disent', async () => {
    for (const code of ['pro_required', 'own_offer'] as const) {
      rpc.mockResolvedValueOnce({ data: null, error: { code: 'P0001', message: code } });
      expect(await prepareServerCheckout({ ...input, courier: false })).toEqual({
        ok: false,
        code,
      });
    }
  });
});

describe('annuler une réservation (migration 0020)', () => {
  it('sans page de paiement ouverte : le serveur annule directement', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    expect(await cancelOrder(ORDER_ID)).toEqual({ ok: true, value: null });
    expect(edge).not.toHaveBeenCalled();
  });

  it('page de paiement ouverte : le serveur la fait expirer chez Stripe, puis annule', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'P0001', message: 'checkout_open' } });
    edge.mockResolvedValueOnce({ ok: true, data: { cancelled: true } });
    expect(await cancelOrder(ORDER_ID)).toEqual({ ok: true, value: null });
    expect(edge).toHaveBeenCalledWith('order-cancel', { orderId: ORDER_ID });
  });

  it('le paiement vient d’aboutir : la commande reste payée, et on le dit', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'P0001', message: 'checkout_open' } });
    edge.mockResolvedValueOnce({ ok: false, code: 'already_paid', status: 409 });
    expect(await cancelOrder(ORDER_ID)).toEqual({ ok: false, code: 'already_paid' });
  });

  it('un code de la course Uber ne se confond pas avec celui d’une réservation', () => {
    expect(classifyOrdersError({ message: 'courier_not_cancellable' })).toBe(
      'courier_not_cancellable',
    );
    expect(classifyOrdersError({ message: 'not_cancellable' })).toBe('not_cancellable');
  });
});

describe('fiche d’une commande du serveur', () => {
  const order = (o: Record<string, unknown> = {}) => toServerOrder(row(o) as never, () => '🥐');
  const NOW = Date.parse('2026-11-13T18:05:00Z');

  it('à payer : « Payer » ouvre la page Stripe, puis la commande est relue', async () => {
    edge.mockResolvedValueOnce({ ok: true, data: { url: 'https://checkout.stripe.com/c/pay/x' } });
    const onChanged = jest.fn();
    render(
      <ServerOrderPanel
        order={order({ status: 'paiement_attente' })}
        now={NOW}
        onChanged={onChanged}
      />,
    );
    expect(screen.getByTestId('server-order-to-pay')).toHaveTextContent(/jusqu’à/);

    fireEvent.press(screen.getByTestId('server-order-pay'));
    await waitFor(() =>
      expect(browser).toHaveBeenCalledWith(
        'https://checkout.stripe.com/c/pay/x',
        'tklink://commande',
      ),
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('réservation expirée : plus de bouton « Payer »', () => {
    render(
      <ServerOrderPanel
        order={order({ status: 'paiement_attente', reserved_until: '2026-11-13T17:00:00Z' })}
        now={NOW}
        onChanged={jest.fn()}
      />,
    );
    expect(screen.getByTestId('server-order-to-pay')).toHaveTextContent(/Réservation expirée/);
    expect(screen.queryByTestId('server-order-pay')).toBeNull();
  });

  it('payée en Touch & Collect : le code de retrait s’affiche, avec son QR', async () => {
    rpc.mockResolvedValueOnce({ data: '048213', error: null });
    render(<ServerOrderPanel order={order()} now={NOW} onChanged={jest.fn()} />);
    expect(await screen.findByTestId('server-order-pickup-code')).toHaveTextContent('048213');
    expect(rpc).toHaveBeenCalledWith('order_pickup_code', { p_order: ORDER_ID });
    expect(JSON.parse(pickupPayload(ORDER_ID, '048213'))).toEqual({
      v: 1,
      id: ORDER_ID,
      code: '048213',
    });
  });

  it('livraison : le lien de suivi Uber, et « Signaler un problème » ouvre les trois motifs', () => {
    render(
      <ServerOrderPanel
        order={order({
          fulfilment: 'livraison',
          status: 'en_livraison',
          uber_tracking_url: 'https://www.ubr.to/abc',
        })}
        now={NOW}
        onChanged={jest.fn()}
      />,
    );
    expect(screen.getByTestId('server-order-tracking')).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('order-report-open'));
    expect(screen.getByTestId('order-report')).toBeOnTheScreen();
  });

  it('annulée : pas de signalement, le support reste joignable', () => {
    render(
      <ServerOrderPanel order={order({ status: 'annulee' })} now={NOW} onChanged={jest.fn()} />,
    );
    expect(screen.queryByTestId('order-report-open')).toBeNull();
    fireEvent.press(screen.getByTestId('server-order-report'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/aide/nouvelle',
      params: { commande: ORDER_ID, sujet: 'commande' },
    });
  });
});

it('au démarrage, aucune commande du serveur n’est lue du disque (rien n’est persisté)', () => {
  // Rien n’est persisté : au démarrage, aucune commande du serveur n’est sur le disque.
  expect(useServerOrdersStore.getState().mine).toEqual([]);
});
