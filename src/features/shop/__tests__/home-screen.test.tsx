import { fireEvent, render, screen, waitFor } from '@/shared/testing/render';

import { DEFAULT_PREFERENCES } from '../lib/preferences';
import { getDeal } from '../model/catalog';
import { useShopStore } from '../model/store';
import { HomeScreen } from '../ui/home-screen';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
  }),
}));
jest.mock('expo-image', () => ({ Image: () => null }));
// La carte Mapbox est native : on ne teste ici que le basculement vers elle.
jest.mock('../ui/map-view', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- la fabrique ne voit pas les imports
  const { View } = require('react-native');
  return { DealsMap: () => <View testID="deals-map" /> };
});
// Pas de permission GPS sous Jest : la position est connue (ou non) par le store.
jest.mock('../lib/location', () => ({ getUserCoord: jest.fn().mockResolvedValue(null) }));

beforeEach(() => {
  mockPush.mockClear();
  useShopStore.setState({
    favorites: [],
    cart: [],
    preferences: DEFAULT_PREFERENCES,
    userCoord: null,
  });
});

describe('<HomeScreen />', () => {
  it('affiche l’espace TK LINK, le titre du fil et le compteur d’invendus', async () => {
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByTestId('home-screen')).toBeOnTheScreen());

    // L'espace de communication remplace la vente flash mise en avant.
    expect(screen.getByTestId('home-slides')).toBeOnTheScreen();
    expect(screen.queryByTestId('featured-deal')).toBeNull();
    expect(screen.getByText('Ça part maintenant')).toBeOnTheScreen();
    expect(screen.getByText(/invendus à sauver/)).toBeOnTheScreen();
    expect(screen.getByText('Toulouse Centre')).toBeOnTheScreen();
  });

  it('l’espace TK LINK présente l’app, et la diapositive du parrainage y mène', () => {
    render(<HomeScreen />);
    expect(screen.getByTestId('home-slide-flash')).toHaveTextContent(/offres flash/);
    expect(screen.getByTestId('home-slide-touch-collect')).toHaveTextContent(/gratuit/);
    expect(screen.getByTestId('home-slide-parrainage')).toHaveTextContent(/5 €/);

    fireEvent.press(screen.getByTestId('home-slide-parrainage'));
    expect(mockPush).toHaveBeenCalledWith('/parrainage');
  });

  it('la côte de bœuf n’est plus mise en avant, mais reste dans le fil', () => {
    render(<HomeScreen />);
    expect(screen.queryByTestId('featured-deal')).toBeNull();
    expect(screen.getByTestId('deal-d_cote')).toBeOnTheScreen();
  });

  it('filtre par catégorie : les offres d’une autre catégorie disparaissent', () => {
    render(<HomeScreen />);
    // Les offres sont triées par urgence : on cherche « une offre cinéma », pas une en particulier.
    const cinema = () => screen.queryAllByTestId(/^deal-d_cin/);
    expect(cinema().length).toBeGreaterThan(0);

    fireEvent.press(screen.getByTestId('cat-restauration'));
    expect(cinema()).toHaveLength(0);
    expect(screen.getByTestId('deal-d_cote')).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('cat-tous'));
    expect(cinema().length).toBeGreaterThan(0);
  });

  it('cherche par mot-clé, puis dit qu’il n’y a rien quand rien ne correspond', () => {
    render(<HomeScreen />);
    fireEvent.changeText(screen.getByTestId('home-search'), 'cassoulet');
    expect(screen.getByTestId('deal-d_cassoulet')).toBeOnTheScreen();
    expect(screen.queryByTestId('deal-d_cote')).toBeNull();

    fireEvent.changeText(screen.getByTestId('home-search'), 'zzzzzz');
    expect(screen.getByTestId('home-empty')).toBeOnTheScreen();
    expect(screen.getByText('Aucune offre pour cette recherche')).toBeOnTheScreen();
  });

  it('met une offre en favori depuis sa carte', () => {
    render(<HomeScreen />);
    fireEvent.changeText(screen.getByTestId('home-search'), 'cassoulet');

    fireEvent.press(screen.getByTestId('fav-d_cassoulet'));
    expect(useShopStore.getState().favorites).toContain('d_cassoulet');

    fireEvent.press(screen.getByTestId('fav-d_cassoulet'));
    expect(useShopStore.getState().favorites).not.toContain('d_cassoulet');
  });

  it('montre les offres publiées par le commerçant, soumises aux mêmes filtres', () => {
    const extra = { ...getDeal('d_cote')!, id: 'extra_1', title: 'Offre publiée du jour' };
    render(<HomeScreen extraDeals={[extra]} />);

    fireEvent.changeText(screen.getByTestId('home-search'), 'publiée');
    expect(screen.getByTestId('deal-extra_1')).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('cat-services'));
    expect(screen.queryByTestId('deal-extra_1')).toBeNull();
  });

  it('sépare les centres d’intérêt déclarés du reste des offres', () => {
    render(<HomeScreen interests={['services']} />);

    expect(screen.getByTestId('home-others-divider')).toBeOnTheScreen();
    expect(screen.getByText('Autres offres du quartier')).toBeOnTheScreen();
    expect(screen.getByText(/pour vous ·/)).toBeOnTheScreen();
  });

  it('annonce l’élargissement du rayon quand rien n’est assez proche', () => {
    // Un utilisateur à Paris : aucune offre toulousaine dans 5 km.
    useShopStore.setState({ userCoord: { lat: 48.8566, lng: 2.3522 } });
    render(<HomeScreen />);

    const notice = screen.getByTestId('home-radius-relaxed');
    expect(notice).toBeOnTheScreen();
    fireEvent.press(notice);
    expect(mockPush).toHaveBeenCalledWith('/preferences');
  });

  it('compte les filtres actifs sur le bouton de préférences', () => {
    useShopStore.setState({
      preferences: { ...DEFAULT_PREFERENCES, radiusKm: 3, lifestyle: ['halal'] },
    });
    render(<HomeScreen />);
    expect(screen.getByTestId('home-preferences')).toHaveTextContent(/2/);
  });

  it('bascule sur la carte : même écran, plus de liste', () => {
    render(<HomeScreen />);
    fireEvent.press(screen.getByTestId('home-view-carte'));

    expect(screen.getByTestId('deals-map')).toBeOnTheScreen();
    expect(screen.queryByTestId('home-search')).toBeNull();
  });
});
