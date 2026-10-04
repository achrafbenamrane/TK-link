import { pickupPin } from '@/shared/lib/handover';
import { render, screen } from '@/shared/testing/render';

import { missionOffers } from '../lib/missions';
import type { Address, Order } from '../model/schema';
import { MerchantOrdersScreen } from '../ui/merchant-orders-screen';
import { useShopStore } from '../model/store';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => false,
  }),
}));

const order = (over: Partial<Order> = {}): Order => ({
  id: 'ord_1',
  createdAt: Date.now(),
  addressId: 'a1',
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
  ...over,
});

const address: Address = {
  id: 'a1',
  label: 'Maison',
  street: '12 rue des Fleurs',
  zip: '31000',
  city: 'Toulouse',
  isDefault: true,
};

describe('missionOffers — les commandes prêtes en livraison', () => {
  it('ne propose que les livraisons prêtes', () => {
    const offers = missionOffers(
      [
        order(),
        order({ id: 'ord_2', status: 'preparation' }),
        order({ id: 'ord_3', fulfilment: 'touch-collect' }),
      ],
      [address],
    );
    expect(offers.map((o) => o.orderId)).toEqual(['ord_1']);
  });

  it('nomme le commerçant, l’adresse de remise et n’invente aucune distance', () => {
    const [offer] = missionOffers([order()], [address]);
    expect(offer).toMatchObject({
      itemCount: 2,
      totalEur: 13.8,
      dropoff: '12 rue des Fleurs, 31000 Toulouse',
      distanceKm: null,
    });
    expect(offer?.merchantName.length).toBeGreaterThan(0);
  });
});

describe('remise au livreur côté commerçant', () => {
  it('affiche le code de remise d’une livraison prête, pas d’un retrait', () => {
    useShopStore.setState({
      orders: [order(), order({ id: 'ord_2', fulfilment: 'touch-collect' })],
    });
    render(<MerchantOrdersScreen dealIds={['d_pizza']} />);

    expect(screen.getByTestId('merchant-order-ord_1-pin')).toHaveTextContent(pickupPin('ord_1'));
    expect(screen.queryByTestId('merchant-order-ord_2-handover')).toBeNull();
  });
});
