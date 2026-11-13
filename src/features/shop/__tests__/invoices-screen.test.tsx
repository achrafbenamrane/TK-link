import { render, screen } from '@/shared/testing/render';

import { isInvoiceable } from '../lib/order-status';
import { toServerOrder } from '../lib/orders-api';
import type { Order } from '../model/schema';
import { useServerOrdersStore } from '../model/server-orders';
import { useShopStore } from '../model/store';
import { InvoicesScreen } from '../ui/invoices-screen';

/**
 * « Mes factures » (13/11/2026) : une facture pour chaque commande PAYÉE — celles du serveur
 * comprises, qui n'y figuraient pas — et un montant qui compte la livraison.
 */
jest.mock('@/shared/lib/supabase', () => ({
  supabase: { auth: { getSession: jest.fn() }, from: jest.fn(), rpc: jest.fn() },
}));

const serverOrder = (id: string, status: string, deliveryCents = 0) =>
  toServerOrder(
    {
      id,
      shop_id: 'shop-1',
      fulfilment: deliveryCents > 0 ? 'livraison' : 'touch-collect',
      status,
      subtotal_cents: 700,
      discount_cents: 0,
      delivery_fee_cents: deliveryCents,
      total_cents: 700 + deliveryCents,
      delivery_address: null,
      delivery_lat: null,
      delivery_lng: null,
      reserved_until: '2026-11-13T18:15:00Z',
      uber_tracking_url: null,
      created_at: '2026-11-13T18:00:00Z',
      flash_order_items: [
        { offer_id: 'o-1', title: 'Quiche lorraine', qty: 1, unit_price_cents: 700 },
      ],
    } as Parameters<typeof toServerOrder>[0],
    () => '🥧',
  );

const localOrder: Order = {
  id: 'local_ord_abc123',
  createdAt: Date.parse('2026-11-12T12:00:00Z'),
  addressId: null,
  items: [{ dealId: 'd_pizza', title: 'Pizza Margherita', emoji: '🍕', qty: 1, price: 6.9 }],
  total: 6.9,
  discount: 0,
  deliveryFee: 0,
  fulfilment: 'touch-collect',
  status: 'recuperee',
  pointsEarned: 7,
  managed: true,
  rating: null,
  issue: null,
};

beforeEach(() => {
  useShopStore.setState({ orders: [localOrder] });
  useServerOrdersStore.setState({
    mine: [
      serverOrder('11111111-1111-4111-8111-1111111aa001', 'livree', 300),
      serverOrder('11111111-1111-4111-8111-1111111aa002', 'paiement_attente'),
      serverOrder('11111111-1111-4111-8111-1111111aa003', 'annulee'),
    ],
    // L'écran relit le serveur en arrivant : ici, rien à relire.
    refreshMine: jest.fn(async () => {}),
  });
});

it('montre les commandes payées du serveur à côté des commandes locales', () => {
  render(<InvoicesScreen />);
  expect(screen.getByTestId('invoice-11111111-1111-4111-8111-1111111aa001')).toBeTruthy();
  expect(screen.getByTestId('invoice-local_ord_abc123')).toBeTruthy();
  // Une réservation jamais payée, ou annulée avant paiement, n'a pas de facture.
  expect(screen.queryByTestId('invoice-11111111-1111-4111-8111-1111111aa002')).toBeNull();
  expect(screen.queryByTestId('invoice-11111111-1111-4111-8111-1111111aa003')).toBeNull();
});

it('le montant de la facture compte la livraison', () => {
  render(<InvoicesScreen />);
  // 7,00 € d'articles + 3,00 € de livraison.
  expect(
    screen.getByTestId('invoice-11111111-1111-4111-8111-1111111aa001-total'),
  ).toHaveTextContent('10,00 €');
  expect(screen.getByText('#TKL-1AA001')).toBeTruthy();
});

it('ce qui a une facture : tout ce qui a été payé, même remboursé', () => {
  expect(isInvoiceable('payee')).toBe(true);
  expect(isInvoiceable('remboursee')).toBe(true);
  expect(isInvoiceable('paiement_attente')).toBe(false);
  expect(isInvoiceable('annulee')).toBe(false);
  expect(isInvoiceable('panier')).toBe(false);
});
