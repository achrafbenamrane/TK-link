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
    render(<HandoverScreen demo orderId={order.id} courier={courier} onBack={jest.fn()} />);
    fireEvent.press(screen.getByTestId('handover-biometric'));
    expect(screen.getByTestId('handover-validated')).toBeTruthy();

    fireEvent.press(screen.getByTestId('handover-confirm'));
    expect(useShopStore.getState().orders[0]?.status).toBe('en_livraison');
    expect(screen.getAllByText('Colis remis').length).toBeGreaterThan(0);
  });

  it('l’empreinte posée par le livreur sur SON téléphone valide la remise, sans autre geste', () => {
    render(
      <HandoverScreen
        orderId={order.id}
        courier={courier}
        courierValidatedAt={Date.now()}
        onBack={jest.fn()}
      />,
    );
    expect(screen.getByTestId('handover-validated')).toBeTruthy();

    fireEvent.press(screen.getByTestId('handover-confirm'));
    expect(useShopStore.getState().orders[0]?.status).toBe('en_livraison');
  });
});

describe('<HandoverScreen /> — remise refusée par la machine à états', () => {
  it('n’annonce pas « Colis remis » si la commande n’est pas prête', () => {
    useShopStore.setState({ orders: [{ ...order, status: 'preparation' }] });
    render(
      <HandoverScreen
        orderId={order.id}
        courier={courier}
        courierValidatedAt={Date.now()}
        onBack={jest.fn()}
      />,
    );
    fireEvent.press(screen.getByTestId('handover-confirm'));
    expect(useShopStore.getState().orders[0]?.status).toBe('preparation');
    // Le bouton n'a pas basculé sur « Colis remis » : la remise n'est pas actée.
    expect(screen.getByTestId('handover-confirm')).toHaveTextContent(/Remettre\s+le\s+colis/);
  });
});

describe('<HandoverScreen /> — en production', () => {
  it('ne se valide pas d’un simple geste : seule l’empreinte du livreur le fait', () => {
    useShopStore.setState({ orders: [order] });
    render(<HandoverScreen orderId={order.id} courier={courier} onBack={jest.fn()} />);
    fireEvent.press(screen.getByTestId('handover-biometric'));
    expect(screen.queryByTestId('handover-validated')).toBeNull();
    expect(screen.queryByText(/touchez pour simuler/)).toBeNull();
  });
});
