// Filet anti-crash : on monte chaque écran du parcours démo pour attraper les
// plantages au montage (boucle de sélecteur, accès indéfini…). La route et
// l'image sont neutralisées — on teste le montage, pas la navigation.
import { render, screen } from '@/shared/testing/render';

import { useShopStore } from '../model/store';
import { ChatListScreen } from '../ui/chat-list-screen';
import { FavoritesScreen } from '../ui/favorites-screen';
import { OrdersScreen } from '../ui/orders-screen';
import { ProductScreen } from '../ui/product-screen';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => false,
  }),
}));
jest.mock('expo-image', () => ({ Image: () => null }));

beforeEach(() => {
  // Des données pour exercer les boucles de rendu (map), pas seulement le vide.
  useShopStore.setState({
    orders: [
      {
        id: 'o1',
        createdAt: 1,
        addressId: null,
        items: [{ dealId: 'd_cote', title: 'Côte', emoji: '🥩', qty: 1, price: 24.9 }],
        total: 24.9,
        discount: 0,
        couponCode: null,
        deliveryFee: 0,
        status: 'en_preparation',
        pointsEarned: 24,
      },
    ],
    favorites: ['d_cote'],
  });
});

describe('smoke — écrans shop montent sans planter', () => {
  it('OrdersScreen', () => {
    render(<OrdersScreen />);
    expect(screen.toJSON()).toBeTruthy();
  });

  it('FavoritesScreen', () => {
    render(<FavoritesScreen />);
    expect(screen.toJSON()).toBeTruthy();
  });

  it('ChatListScreen', () => {
    render(<ChatListScreen />);
    expect(screen.toJSON()).toBeTruthy();
  });

  it('ProductScreen', () => {
    render(<ProductScreen dealId="d_cote" />);
    expect(screen.toJSON()).toBeTruthy();
  });
});
