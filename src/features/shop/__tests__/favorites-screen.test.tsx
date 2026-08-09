import { fireEvent, render, screen } from '@/shared/testing/render';

import { DEALS } from '../model/catalog';
import { useShopStore } from '../model/store';
import { FavoritesScreen } from '../ui/favorites-screen';

// Même mock que les autres écrans du dossier : expo-router n'est pas
// transformable tel quel par Jest. `jest.mock` est remonté par Babel avant les
// imports, l'ordre d'écriture n'a donc pas d'importance.
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => false,
  }),
}));

const [d1, d2, d3] = DEALS;

beforeEach(() => {
  useShopStore.setState({ favorites: [], cart: [] });
});

describe('<FavoritesScreen />', () => {
  it('affiche l’état vide sans favori', () => {
    render(<FavoritesScreen />);
    expect(screen.getByTestId('favorites-empty')).toBeTruthy();
  });

  it('rend une carte par favori', () => {
    useShopStore.setState({ favorites: [d1!.id, d2!.id] });
    render(<FavoritesScreen />);
    expect(screen.getByTestId(`favorite-card-${d1!.id}`)).toBeTruthy();
    expect(screen.getByTestId(`favorite-card-${d2!.id}`)).toBeTruthy();
  });

  it('tient avec un nombre IMPAIR de favoris (bouche-trou de la grille)', () => {
    useShopStore.setState({ favorites: [d1!.id, d2!.id, d3!.id] });
    render(<FavoritesScreen />);
    expect(screen.getByTestId(`favorite-card-${d3!.id}`)).toBeTruthy();
  });

  it('ajoute au panier depuis la carte', () => {
    useShopStore.setState({ favorites: [d1!.id] });
    render(<FavoritesScreen />);
    fireEvent.press(screen.getByTestId(`favorite-add-${d1!.id}`));
    expect(useShopStore.getState().cart).toEqual([{ dealId: d1!.id, qty: 1 }]);
  });

  it('retire des favoris depuis le cœur', () => {
    useShopStore.setState({ favorites: [d1!.id, d2!.id] });
    render(<FavoritesScreen />);
    fireEvent.press(screen.getByTestId(`favorite-remove-${d1!.id}`));
    expect(useShopStore.getState().favorites).toEqual([d2!.id]);
    expect(screen.queryByTestId(`favorite-card-${d1!.id}`)).toBeNull();
  });

  it('a un accès au panier dans l’en-tête', () => {
    useShopStore.setState({ favorites: [d1!.id], cart: [{ dealId: d1!.id, qty: 2 }] });
    render(<FavoritesScreen />);
    expect(screen.getByTestId('favorites-cart')).toBeTruthy();
    // La pastille montre le nombre d'articles.
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('ignore un favori dont l’offre a disparu du catalogue', () => {
    useShopStore.setState({ favorites: ['offre_supprimee', d1!.id] });
    render(<FavoritesScreen />);
    expect(screen.getByTestId(`favorite-card-${d1!.id}`)).toBeTruthy();
  });
});
