import { fireEvent, render, screen, waitFor } from '@/shared/testing/render';

import {
  advanceB2bOrder,
  type B2bOrder,
  confirmB2bPickup,
  fetchB2bPurchases,
  fetchB2bSales,
} from '../lib/wholesale-api';
import { MerchantPurchasesScreen } from '../ui/purchases-screen';
import { WholesalerOrdersScreen } from '../ui/wholesaler-orders-screen';

/**
 * Le B2B réel des deux côtés (migration 0023), serveur simulé : le grossiste voit ses ventes payées
 * (acheteur, adresse), coche son bon avant d'expédier, remet un retrait contre le code ; le commerçant
 * relit ses achats et ouvre ce qui attend un geste de sa part.
 */
jest.mock('../lib/wholesale-api', () => ({
  fetchB2bSales: jest.fn(),
  fetchB2bPurchases: jest.fn(),
  advanceB2bOrder: jest.fn(),
  confirmB2bPickup: jest.fn(),
}));

const sales = fetchB2bSales as jest.Mock;
const purchases = fetchB2bPurchases as jest.Mock;
const advance = advanceB2bOrder as jest.Mock;
const pickup = confirmB2bPickup as jest.Mock;

const order = (o: Partial<B2bOrder> = {}): B2bOrder => ({
  id: 'order-0000-aaaa11',
  status: 'preparation',
  fulfilment: 'livraison',
  title: 'Farine T65 (sac 25 kg)',
  qty: 150,
  totalCents: 270000,
  counterpart: 'Le Petit Toulousain',
  address: '8 rue des Carmes, 31000 Toulouse',
  at: Date.parse('2026-11-14T09:00:00Z'),
  ...o,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('les ventes du grossiste', () => {
  it('montre l’acheteur et l’adresse, et n’expédie qu’une fois le bon coché', async () => {
    sales.mockResolvedValue({ ok: true, value: [order()] });
    advance.mockResolvedValue({ ok: true, value: null });
    render(<WholesalerOrdersScreen server />);

    const id = 'order-0000-aaaa11';
    expect(await screen.findByText(/Le Petit Toulousain/)).toBeTruthy();
    expect(screen.getByText(/#TKL-AAAA11/)).toBeTruthy();
    expect(screen.getByTestId(`wholesaler-order-${id}-address`)).toHaveTextContent(
      '8 rue des Carmes, 31000 Toulouse',
    );

    // Bon pas coché : le bouton le dit, et rien ne part au serveur.
    fireEvent.press(screen.getByTestId(`wholesaler-order-${id}-advance`));
    expect(advance).not.toHaveBeenCalled();
    for (const step of ['preleve', 'emballe', 'etiquete']) {
      fireEvent.press(screen.getByTestId(`wholesaler-order-${id}-prep-${step}`));
    }
    fireEvent.press(screen.getByTestId(`wholesaler-order-${id}-advance`));
    await waitFor(() => expect(advance).toHaveBeenCalledWith(id, 'en_livraison'));
    // Puis la liste est relue.
    expect(sales).toHaveBeenCalledTimes(2);
  });

  it('payée : on prépare tout de suite (pas d’« Accepter »)', async () => {
    sales.mockResolvedValue({ ok: true, value: [order({ status: 'payee' })] });
    advance.mockResolvedValue({ ok: true, value: null });
    render(<WholesalerOrdersScreen server />);

    const button = await screen.findByTestId('wholesaler-order-order-0000-aaaa11-advance');
    expect(button).toHaveTextContent('Préparer la commande');
    fireEvent.press(button);
    await waitFor(() => expect(advance).toHaveBeenCalledWith('order-0000-aaaa11', 'preparation'));
  });

  it('retrait chez lui : remise contre le code à six chiffres ; un mauvais code se dit', async () => {
    sales.mockResolvedValue({
      ok: true,
      value: [order({ status: 'prete', fulfilment: 'touch-collect', address: null })],
    });
    pickup.mockResolvedValue({ ok: false, code: 'invalid' });
    render(<WholesalerOrdersScreen server />);

    const id = 'order-0000-aaaa11';
    fireEvent.changeText(await screen.findByTestId(`wholesaler-order-${id}-code`), '12 34 56');
    fireEvent.press(screen.getByTestId(`wholesaler-order-${id}-handover`));
    await waitFor(() => expect(pickup).toHaveBeenCalledWith(id, '123456'));
    expect(await screen.findByTestId(`wholesaler-order-${id}-error`)).toHaveTextContent(
      /Code incorrect/,
    );
  });

  it('les commandes livrées passent dans « Terminées »', async () => {
    sales.mockResolvedValue({ ok: true, value: [order({ status: 'livree' })] });
    render(<WholesalerOrdersScreen server />);

    expect(await screen.findByTestId('wholesaler-orders-empty')).toBeTruthy();
    fireEvent.press(screen.getByTestId('wholesaler-filter-done'));
    expect(screen.getByTestId('wholesaler-order-order-0000-aaaa11-status')).toHaveTextContent(
      'LIVRÉE',
    );
  });
});

describe('les achats du commerçant', () => {
  it('relit ses achats ; ce qui attend un geste (payer) s’ouvre', async () => {
    purchases.mockResolvedValue({
      ok: true,
      value: [
        order({ id: 'p-1', status: 'paiement_attente', counterpart: 'Grossiste Occitan' }),
        order({ id: 'p-2', status: 'en_livraison', counterpart: 'Grossiste Occitan' }),
      ],
    });
    const onOpenOrder = jest.fn();
    render(<MerchantPurchasesScreen server onOpenOrder={onOpenOrder} />);

    expect(await screen.findByTestId('purchase-status-p-1')).toHaveTextContent('À payer');
    expect(screen.getByTestId('purchase-status-p-2')).toHaveTextContent('Expédiée');
    // Seul ce qui est payé compte dans « payés aux grossistes ».
    expect(screen.getByTestId('purchases-spent')).toHaveTextContent(/2\s?700,00/);

    fireEvent.press(screen.getByTestId('purchase-p-1'));
    expect(onOpenOrder).toHaveBeenCalledWith('p-1');
    fireEvent.press(screen.getByTestId('purchase-p-2'));
    expect(onOpenOrder).toHaveBeenCalledTimes(1);
  });
});
