import { act, fireEvent, render, screen, waitFor } from '@/shared/testing/render';

import { callEdge } from '@/shared/lib/edge';
import { supabase } from '@/shared/lib/supabase';

import { toServerOrder } from '../lib/orders-api';
import { parsePickupQr, pickupPayload } from '../lib/pickup';
import { useServerOrdersStore } from '../model/server-orders';
import { MerchantOrdersScreen } from '../ui/merchant-orders-screen';

/**
 * Les commandes reçues du serveur, au comptoir (rapport d’avancement du 13/11/2026) : préparer,
 * remettre au client contre son code, appeler un coursier Uber Direct. Le serveur est simulé.
 */
jest.mock('@/shared/lib/edge', () => ({ callEdge: jest.fn() }));
jest.mock('@/shared/lib/supabase', () => ({
  supabase: { auth: { getSession: jest.fn() }, from: jest.fn(), rpc: jest.fn() },
}));

// La caméra : on garde la fonction de lecture que l'écran lui passe, pour simuler un scan.
let mockScan: ((event: { data: string }) => void) | undefined;
jest.mock('expo-camera', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- why: une fabrique de jest.mock ne capture pas un import
  const { View } = require('react-native');
  return {
    useCameraPermissions: () => [{ granted: true, status: 'granted' }, jest.fn()],
    CameraView: (props: { testID?: string; onBarcodeScanned?: (e: { data: string }) => void }) => {
      mockScan = props.onBarcodeScanned;
      return <View testID={props.testID} />;
    },
  };
});

const rpc = supabase.rpc as unknown as jest.Mock;
const edge = callEdge as jest.Mock;

const ID = '44444444-4444-4444-8444-444444444444';
const order = (o: Record<string, unknown>) =>
  toServerOrder(
    {
      id: ID,
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
      flash_order_items: [{ offer_id: 'o-1', title: 'Brioche', qty: 2, unit_price_cents: 200 }],
      ...o,
    } as never,
    () => '🥐',
  );

/** Le magasin tient les commandes ; la relecture est neutralisée (rien à relire en test). */
function seed(orders: ReturnType<typeof order>[]) {
  useServerOrdersStore.setState({
    shop: orders,
    refreshShop: jest.fn(async () => undefined),
  });
}

beforeEach(() => {
  rpc.mockReset();
  edge.mockReset();
});

it('payée : « En préparation » passe par le serveur', async () => {
  seed([order({})]);
  rpc.mockResolvedValue({ data: null, error: null });
  render(<MerchantOrdersScreen server />);

  fireEvent.press(screen.getByTestId(`merchant-order-${ID}-preparation`));
  await waitFor(() =>
    expect(rpc).toHaveBeenCalledWith('advance_order', { p_order: ID, p_status: 'preparation' }),
  );
});

it('livraison en préparation : « appeler un coursier » commande la course Uber Direct', async () => {
  seed([order({ fulfilment: 'livraison', status: 'preparation', delivery_address: 'x' })]);
  edge.mockResolvedValue({ ok: true, data: { trackingUrl: 'https://www.ubr.to/x' } });
  render(<MerchantOrdersScreen server />);

  expect(screen.getByTestId(`merchant-order-${ID}-dispatch`)).toHaveTextContent(
    /appeler un coursier/,
  );
  fireEvent.press(screen.getByTestId(`merchant-order-${ID}-dispatch`));
  await waitFor(() => expect(edge).toHaveBeenCalledWith('uber-dispatch', { orderId: ID }));
});

it('remise en boutique : le code du client est vérifié par le serveur', async () => {
  seed([order({ status: 'prete' })]);
  rpc.mockResolvedValueOnce({ data: null, error: { code: 'P0001', message: 'pickup_refused' } });
  render(<MerchantOrdersScreen server />);

  fireEvent.press(screen.getByTestId(`merchant-order-${ID}-pickup`));
  const input = screen.getByTestId(`merchant-order-${ID}-code`);
  fireEvent.changeText(input, '12a34');
  // Que des chiffres, six au plus ; le bouton attend les six.
  expect(
    screen.getByTestId(`merchant-order-${ID}-code-submit`).props.accessibilityState,
  ).toMatchObject({ disabled: true });
  fireEvent.changeText(input, '123456');
  await act(async () => {
    fireEvent.press(screen.getByTestId(`merchant-order-${ID}-code-submit`));
  });
  expect(rpc).toHaveBeenCalledWith('confirm_pickup', { p_order: ID, p_code: '123456' });
  expect(await screen.findByTestId(`merchant-order-${ID}-error`)).toHaveTextContent(
    /Code de retrait incorrect/,
  );
});

it('livraison prête : le coursier est en route, rien à faire au comptoir', () => {
  seed([
    order({
      fulfilment: 'livraison',
      status: 'prete',
      delivery_address: 'x',
      uber_status: 'pickup',
    }),
  ]);
  render(<MerchantOrdersScreen server />);
  expect(screen.getByTestId(`merchant-order-${ID}-server`)).toHaveTextContent(
    /Coursier Uber Direct en route/,
  );
  expect(screen.queryByTestId(`merchant-order-${ID}-dispatch`)).toBeNull();
});

it('course pas encore prise : « Annuler la course » se confirme, puis passe par Uber', async () => {
  seed([
    order({
      fulfilment: 'livraison',
      status: 'prete',
      delivery_address: 'x',
      uber_status: 'pending',
    }),
  ]);
  edge.mockResolvedValue({ ok: true, data: { cancelled: true } });
  render(<MerchantOrdersScreen server />);

  const cancel = screen.getByTestId(`merchant-order-${ID}-cancel-courier`);
  fireEvent.press(cancel);
  // Premier appui : on demande confirmation, rien ne part.
  expect(edge).not.toHaveBeenCalled();
  expect(cancel).toHaveTextContent(/Confirmer/);
  fireEvent.press(cancel);
  await waitFor(() => expect(edge).toHaveBeenCalledWith('uber-cancel', { orderId: ID }));
});

it('course annulée : la commande reste prête, et on peut rappeler un coursier', async () => {
  seed([
    order({ fulfilment: 'livraison', status: 'prete', delivery_address: 'x', uber_status: null }),
  ]);
  edge.mockResolvedValue({ ok: true, data: { trackingUrl: null } });
  render(<MerchantOrdersScreen server />);

  expect(screen.queryByTestId(`merchant-order-${ID}-cancel-courier`)).toBeNull();
  fireEvent.press(screen.getByTestId(`merchant-order-${ID}-dispatch`));
  await waitFor(() => expect(edge).toHaveBeenCalledWith('uber-dispatch', { orderId: ID }));
  expect(screen.getByTestId(`merchant-order-${ID}-dispatch`)).toHaveTextContent(/Rappeler/);
});

it('Uber refuse l’annulation : le commerçant le sait', async () => {
  seed([
    order({
      fulfilment: 'livraison',
      status: 'prete',
      delivery_address: 'x',
      uber_status: 'pickup',
    }),
  ]);
  edge.mockResolvedValue({ ok: false, code: 'cancel_refused', status: 409 });
  render(<MerchantOrdersScreen server />);

  fireEvent.press(screen.getByTestId(`merchant-order-${ID}-cancel-courier`));
  fireEvent.press(screen.getByTestId(`merchant-order-${ID}-cancel-courier`));
  expect(await screen.findByTestId(`merchant-order-${ID}-error`)).toHaveTextContent(
    /n’a pas pu annuler/,
  );
});

it('annulation en cours chez Uber : le commerçant le voit, et ne peut ni annuler ni rappeler', () => {
  seed([
    order({
      fulfilment: 'livraison',
      status: 'prete',
      delivery_address: 'x',
      uber_status: 'cancelling',
    }),
  ]);
  render(<MerchantOrdersScreen server />);
  expect(screen.getByTestId(`merchant-order-${ID}-server`)).toHaveTextContent(
    /Annulation de la course/,
  );
  expect(screen.queryByTestId(`merchant-order-${ID}-cancel-courier`)).toBeNull();
  expect(screen.queryByTestId(`merchant-order-${ID}-dispatch`)).toBeNull();
});

it('le numéro du commerce manque : le commerçant sait quoi corriger', async () => {
  seed([order({ fulfilment: 'livraison', status: 'preparation', delivery_address: 'x' })]);
  edge.mockResolvedValue({ ok: false, code: 'shop_phone_missing', status: 422 });
  render(<MerchantOrdersScreen server />);
  fireEvent.press(screen.getByTestId(`merchant-order-${ID}-dispatch`));
  expect(await screen.findByTestId(`merchant-order-${ID}-error`)).toHaveTextContent(
    /numéro de votre commerce/,
  );
});

describe('scanner le QR de retrait', () => {
  it('le QR de CETTE commande remet la commande (le serveur vérifie le code)', async () => {
    seed([order({ status: 'prete' })]);
    rpc.mockResolvedValue({ data: null, error: null });
    render(<MerchantOrdersScreen server />);

    fireEvent.press(screen.getByTestId(`merchant-order-${ID}-pickup`));
    fireEvent.press(screen.getByTestId(`merchant-order-${ID}-scan`));
    expect(screen.getByTestId(`merchant-order-${ID}-scanner`)).toBeOnTheScreen();

    await act(async () => {
      mockScan?.({ data: pickupPayload(ID, '048213') });
    });
    expect(rpc).toHaveBeenCalledWith('confirm_pickup', { p_order: ID, p_code: '048213' });
  });

  it('le QR d’une autre commande est refusé sur place, sans appel au serveur', () => {
    seed([order({ status: 'prete' })]);
    render(<MerchantOrdersScreen server />);
    fireEvent.press(screen.getByTestId(`merchant-order-${ID}-pickup`));
    fireEvent.press(screen.getByTestId(`merchant-order-${ID}-scan`));

    act(() => {
      mockScan?.({ data: pickupPayload('99999999-9999-4999-8999-999999999999', '048213') });
    });
    expect(screen.getByTestId(`merchant-order-${ID}-wrong-qr`)).toBeOnTheScreen();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('ne reconnaît que les QR de retrait TK LINK', () => {
    expect(parsePickupQr(pickupPayload(ID, '123456'))).toEqual({ orderId: ID, code: '123456' });
    expect(parsePickupQr('https://exemple.fr')).toBeNull();
    expect(parsePickupQr(JSON.stringify({ v: 1, id: ID, code: '12' }))).toBeNull();
  });
});
