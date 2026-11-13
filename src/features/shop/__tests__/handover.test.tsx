import { fireEvent, render, screen } from '@/shared/testing/render';

import type { Order } from '../model/schema';
import { useShopStore } from '../model/store';
import { HandoverScreen } from '../ui/handover-screen';

jest.mock('expo-router', () => ({
  // Valeurs par défaut d'abord (useFocusEffect…), remplacements ensuite.
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- why: une fabrique de jest.mock ne capture pas un import
  ...require('@/shared/testing/expo-router-mock').expoRouterDefaults(),
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => false,
  }),
}));

const order: Order = {
  id: 'ord_xyz123',
  createdAt: Date.now(),
  addressId: null,
  items: [{ dealId: 'd_pizza', title: 'Pizza', emoji: '🍕', qty: 2, price: 6.9 }],
  total: 13.8,
  discount: 0,
  deliveryFee: 0,
  fulfilment: 'livraison',
  status: 'prete',
  pointsEarned: 14,
  managed: true,
  rating: null,
  issue: null,
};

/**
 * Depuis le 13/11/2026, TK LINK n'a plus de livreurs : le commerçant confie la commande à un
 * coursier partenaire (Uber Direct). Plus d'identité, de véhicule ni d'empreinte à vérifier.
 */
describe('<HandoverScreen /> — remise au coursier partenaire', () => {
  beforeEach(() => useShopStore.setState({ orders: [order] }));

  it('présente le coursier partenaire, sans livreur TK LINK ni empreinte', () => {
    render(<HandoverScreen orderId={order.id} onBack={jest.fn()} />);
    expect(screen.getByTestId('handover-partner')).toHaveTextContent(/Coursier Uber Direct/);
    expect(screen.queryByTestId('handover-biometric')).toBeNull();
    expect(screen.queryByText(/livreur/i)).toBeNull();
    expect(screen.queryByTestId('handover-done')).toBeNull();
  });

  it('remettre la commande la passe « En livraison »', () => {
    render(<HandoverScreen orderId={order.id} onBack={jest.fn()} />);
    fireEvent.press(screen.getByTestId('handover-confirm'));

    expect(useShopStore.getState().orders[0]?.status).toBe('en_livraison');
    expect(screen.getByTestId('handover-done')).toBeTruthy();
    expect(screen.getByTestId('handover-confirm')).toHaveTextContent(/Commande\s+remise/);
  });

  it('une commande déjà partie s’affiche comme remise, sans second geste', () => {
    useShopStore.setState({ orders: [{ ...order, status: 'en_livraison' }] });
    render(<HandoverScreen orderId={order.id} onBack={jest.fn()} />);
    expect(screen.getByTestId('handover-done')).toBeTruthy();
    fireEvent.press(screen.getByTestId('handover-confirm'));
    expect(useShopStore.getState().orders[0]?.status).toBe('en_livraison');
  });
});

describe('<HandoverScreen /> — remise refusée par la machine à états', () => {
  it('n’annonce rien si la commande n’est pas prête', () => {
    useShopStore.setState({ orders: [{ ...order, status: 'preparation' }] });
    render(<HandoverScreen orderId={order.id} onBack={jest.fn()} />);
    fireEvent.press(screen.getByTestId('handover-confirm'));
    expect(useShopStore.getState().orders[0]?.status).toBe('preparation');
    expect(screen.queryByTestId('handover-done')).toBeNull();
    expect(screen.getByTestId('handover-confirm')).toHaveTextContent(/Remettre\s+au\s+coursier/);
  });

  it('un Touch & Collect ne part jamais chez un coursier', () => {
    useShopStore.setState({ orders: [{ ...order, fulfilment: 'touch-collect' }] });
    render(<HandoverScreen orderId={order.id} onBack={jest.fn()} />);
    fireEvent.press(screen.getByTestId('handover-confirm'));
    expect(useShopStore.getState().orders[0]?.status).toBe('prete');
  });

  it('une commande inconnue le dit', () => {
    useShopStore.setState({ orders: [] });
    render(<HandoverScreen orderId="inconnue" onBack={jest.fn()} />);
    expect(screen.getByText('Commande introuvable')).toBeTruthy();
  });
});
