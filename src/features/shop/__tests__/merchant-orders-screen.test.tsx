import { fireEvent, render, screen } from '@/shared/testing/render';

import type { Order } from '../model/schema';
import { useShopStore } from '../model/store';
import { MerchantOrdersScreen } from '../ui/merchant-orders-screen';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

jest.mock('expo-image', () => ({ Image: () => null }));

const MINE = 'pub_offre1';

const order = (over: Partial<Order> = {}): Order => ({
  id: 'o_1',
  createdAt: Date.now(),
  addressId: null,
  items: [{ dealId: MINE, title: 'Plateau de viennoiseries', emoji: '🥐', qty: 2, price: 9 }],
  total: 18,
  discount: 0,
  couponCode: null,
  deliveryFee: 0,
  fulfilment: 'touch-collect',
  status: 'payee',
  pointsEarned: 18,
  managed: false,
  ...over,
});

beforeEach(() => {
  useShopStore.setState({ orders: [] });
});

describe('<MerchantOrdersScreen /> — CDC §11 et §18', () => {
  it('ne montre QUE les commandes portant sur mes offres', () => {
    useShopStore.setState({
      orders: [
        order({ id: 'o_mine' }),
        order({
          id: 'o_autre',
          items: [{ dealId: 'd_cote', title: 'Côte de bœuf', emoji: '🥩', qty: 1, price: 24 }],
        }),
      ],
    });

    render(<MerchantOrdersScreen dealIds={[MINE]} />);

    expect(screen.getByTestId('merchant-order-o_mine')).toBeTruthy();
    expect(screen.queryByTestId('merchant-order-o_autre')).toBeNull();
  });

  it('sans offre publiée, explique quoi faire au lieu d’afficher un vide muet', () => {
    useShopStore.setState({ orders: [order()] });
    render(<MerchantOrdersScreen dealIds={[]} />);

    expect(screen.getByTestId('merchant-orders-empty')).toBeTruthy();
  });

  it('fait avancer une commande, et l’horloge de démo lâche la main', () => {
    useShopStore.setState({ orders: [order()] });
    render(<MerchantOrdersScreen dealIds={[MINE]} />);

    fireEvent.press(screen.getByTestId('merchant-order-o_1-preparation'));

    const updated = useShopStore.getState().orders[0]!;
    expect(updated.status).toBe('preparation');
    // `managed` est ce qui empêche la simulation d'écraser la décision du
    // commerçant à la seconde suivante.
    expect(updated.managed).toBe(true);

    useShopStore.getState().syncOrderStatuses();
    expect(useShopStore.getState().orders[0]!.status).toBe('preparation');
  });

  it('ne propose jamais un chemin interdit par la machine à états', () => {
    // Touch & Collect : « livrée » n'a aucun sens, seul « récupérée » existe.
    useShopStore.setState({ orders: [order({ status: 'prete' })] });
    render(<MerchantOrdersScreen dealIds={[MINE]} />);

    expect(screen.getByTestId('merchant-order-o_1-recuperee')).toBeTruthy();
    expect(screen.queryByTestId('merchant-order-o_1-livree')).toBeNull();
  });

  it('sépare ce qui attend de ce qui est terminé', () => {
    useShopStore.setState({
      orders: [order({ id: 'o_actif' }), order({ id: 'o_fini', status: 'recuperee' })],
    });
    render(<MerchantOrdersScreen dealIds={[MINE]} />);

    expect(screen.getByTestId('merchant-order-o_actif')).toBeTruthy();
    expect(screen.queryByTestId('merchant-order-o_fini')).toBeNull();

    fireEvent.press(screen.getByTestId('merchant-orders-filter-done'));

    expect(screen.getByTestId('merchant-order-o_fini')).toBeTruthy();
    expect(screen.queryByTestId('merchant-order-o_actif')).toBeNull();
  });
});

describe('setOrderStatus — la garde du §11', () => {
  it('refuse une transition illégale sans rien changer', () => {
    useShopStore.setState({ orders: [order({ status: 'remboursee' })] });

    const result = useShopStore.getState().setOrderStatus('o_1', 'preparation');

    expect(result).toEqual({ ok: false, reason: 'transition' });
    expect(useShopStore.getState().orders[0]!.status).toBe('remboursee');
  });

  it('refuse une commande inconnue', () => {
    expect(useShopStore.getState().setOrderStatus('o_fantome', 'payee')).toEqual({
      ok: false,
      reason: 'introuvable',
    });
  });
});
