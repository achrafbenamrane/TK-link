import { fireEvent, render, screen, waitFor } from '@/shared/testing/render';

import { fetchServerLots } from '../lib/wholesale-api';
import type { PublishedOffer } from '../model/schema';
import { lotBounds } from '../ui/lot-order-panel';
import { WholesaleScreen } from '../ui/wholesale-screen';

/**
 * Le marché B2B avec un serveur (migration 0023) : les offres pro réelles, la quantité jamais sous
 * le minimum du grossiste (CDC V1.1), le mode de remise, puis le paiement en ligne. Le serveur et la
 * caisse sont simulés.
 */
jest.mock('../lib/wholesale-api', () => ({ fetchServerLots: jest.fn() }));

const fetchLots = fetchServerLots as jest.Mock;

const LOT: PublishedOffer = {
  id: 'l-1',
  title: 'Farine T65 (sac 25 kg)',
  category: 'restauration',
  priceCents: 1800,
  oldPriceCents: 2400,
  stock: 500,
  stockLeft: 12,
  durationMinutes: 1440,
  description: '',
  publishedAt: Date.now() - 60_000,
  startsAt: 0,
  state: 'publiee',
  offline: false,
  audience: 'commercants',
  photoUri: '',
  modes: ['touch-collect', 'livraison'],
  seller: 'Grossiste Occitan',
  minQty: 10,
  recurrence: 'aucune',
};

beforeEach(() => {
  fetchLots.mockReset();
});

it('les bornes de la quantité : le minimum du grossiste, le stock, 999 au plus', () => {
  expect(lotBounds({ minQty: 10, stockLeft: 12 })).toEqual({ min: 10, max: 12 });
  expect(lotBounds({ minQty: 1, stockLeft: 5000 })).toEqual({ min: 1, max: 999 });
  expect(lotBounds({ minQty: 0, stockLeft: 3 })).toEqual({ min: 1, max: 3 });
});

it('montre les offres réelles, et commande au minimum, livrée, puis ouvre les achats', async () => {
  fetchLots.mockResolvedValue({ ok: true, value: [LOT] });
  const checkout = jest.fn().mockResolvedValue(null);
  const onPurchases = jest.fn();
  render(<WholesaleScreen checkout={checkout} onPurchases={onPurchases} />);

  expect(await screen.findByText('Farine T65 (sac 25 kg)')).toBeTruthy();
  expect(screen.getByText(/Grossiste Occitan/)).toBeTruthy();

  fireEvent.press(screen.getByTestId('lot-order-l-1'));
  expect(screen.getByTestId('lot-panel-qty-l-1')).toHaveTextContent('10');
  // Jamais sous le minimum ; au plus le stock.
  fireEvent.press(screen.getByTestId('lot-panel-minus-l-1'));
  expect(screen.getByTestId('lot-panel-qty-l-1')).toHaveTextContent('10');
  fireEvent.press(screen.getByTestId('lot-panel-plus-l-1'));
  fireEvent.press(screen.getByTestId('lot-panel-plus-l-1'));
  fireEvent.press(screen.getByTestId('lot-panel-plus-l-1'));
  expect(screen.getByTestId('lot-panel-qty-l-1')).toHaveTextContent('12');

  fireEvent.press(screen.getByTestId('lot-panel-mode-livraison'));
  fireEvent.press(screen.getByTestId('lot-panel-pay-l-1'));

  await waitFor(() => expect(onPurchases).toHaveBeenCalled());
  expect(checkout).toHaveBeenCalledWith({ offerId: 'l-1', qty: 12, fulfilment: 'livraison' });
});

it('un refus de la caisse se dit sous le lot, sans quitter le marché', async () => {
  fetchLots.mockResolvedValue({ ok: true, value: [LOT] });
  const checkout = jest
    .fn()
    .mockResolvedValue('Les offres pro se commandent avec un commerce validé par TK LINK.');
  const onPurchases = jest.fn();
  render(<WholesaleScreen checkout={checkout} onPurchases={onPurchases} />);

  fireEvent.press(await screen.findByTestId('lot-order-l-1'));
  fireEvent.press(screen.getByTestId('lot-panel-pay-l-1'));

  expect(await screen.findByTestId('lot-panel-error')).toHaveTextContent(/commerce validé/);
  expect(onPurchases).not.toHaveBeenCalled();
});

it('le serveur ne répond pas : on le dit, et on peut réessayer', async () => {
  fetchLots.mockResolvedValueOnce({ ok: false, code: 'network' });
  render(<WholesaleScreen checkout={jest.fn()} />);
  expect(await screen.findByTestId('wholesale-load-error')).toBeTruthy();

  fetchLots.mockResolvedValueOnce({ ok: true, value: [] });
  fireEvent.press(screen.getByTestId('wholesale-retry'));
  expect(await screen.findByTestId('wholesale-empty')).toBeTruthy();
});
