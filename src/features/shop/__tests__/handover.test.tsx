import { fireEvent, render, screen } from '@/shared/testing/render';

import type { Order } from '../model/schema';
import { useShopStore } from '../model/store';
import { HandoverScreen } from '../ui/handover-screen';

jest.mock('expo-router', () => ({
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

const courier = { name: 'Alex Martin', vehicle: 'Vélo électrique', verified: true, present: true };

describe('<HandoverScreen /> — validation livreur', () => {
  beforeEach(() => useShopStore.setState({ orders: [order] }));

  it('ne laisse pas remettre le colis avant la validation du livreur', () => {
    render(<HandoverScreen orderId={order.id} courier={courier} onBack={jest.fn()} />);
    expect(screen.getByText('Alex Martin')).toBeTruthy();
    expect(screen.getByText('Compte vérifié')).toBeTruthy();
    expect(screen.queryByTestId('handover-validated')).toBeNull();

    fireEvent.press(screen.getByTestId('handover-confirm'));
    expect(useShopStore.getState().orders[0]?.status).toBe('prete');
  });

  it('une fois l’identité validée, remettre le colis passe la commande en livraison', () => {
    render(<HandoverScreen orderId={order.id} courier={courier} onBack={jest.fn()} />);
    fireEvent.press(screen.getByTestId('handover-biometric'));
    expect(screen.getByTestId('handover-validated')).toBeTruthy();

    fireEvent.press(screen.getByTestId('handover-confirm'));
    expect(useShopStore.getState().orders[0]?.status).toBe('en_livraison');
    expect(screen.getAllByText('Colis remis').length).toBeGreaterThan(0);
  });
});
