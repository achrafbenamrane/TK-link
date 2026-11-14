import { fireEvent, render, screen } from '@/shared/testing/render';

import { useFollowsStore } from '../model/follows';
import { useShopStore } from '../model/store';
import { FavoritesScreen } from '../ui/favorites-screen';

/** Les commerces suivis (0026) en tête des Favoris : on les retrouve, on arrête de les suivre. */
const SHOP = { shopId: 'm_demo', name: 'Boulangerie Saint-Cyprien', area: 'Saint-Cyprien' };

beforeEach(() => {
  useShopStore.setState({ favorites: [] });
  useFollowsStore.setState({ shops: [], loaded: true });
});

describe('<FavoritesScreen /> — les commerces suivis', () => {
  it('rien de suivi : pas de section (et l’état vide des offres reste)', () => {
    render(<FavoritesScreen />);
    expect(screen.queryByTestId('followed-shops')).toBeNull();
    expect(screen.getByTestId('favorites-empty')).toBeTruthy();
  });

  it('montre les commerces suivis ; le cœur arrête de suivre', () => {
    useFollowsStore.setState({ shops: [SHOP], loaded: true });
    render(<FavoritesScreen />);
    expect(screen.getByTestId('followed-shops')).toHaveTextContent(/Boulangerie Saint-Cyprien/);
    fireEvent.press(screen.getByTestId('followed-shop-unfollow-m_demo'));
    expect(screen.queryByTestId('followed-shops')).toBeNull();
  });
});
