import { fireEvent, render, screen } from '@/shared/testing/render';

import { useWelcomeStore } from '../model/store';
import { WelcomeScreen } from '../ui/welcome-screen';

// Préfixe `mock` obligatoire : Babel remonte `jest.mock` au-dessus des
// imports, et seule cette convention autorise la fabrique à voir la variable.
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
}));

// La scène 3D démarre un contexte GL natif : hors simulateur elle n'a rien à
// faire dans un test unitaire. Le repli plat, lui, est bien monté ci-dessous.
jest.mock('../ui/scenes/card-reader-3d', () => ({
  CardReader3D: () => null,
}));

beforeEach(() => {
  useWelcomeStore.setState({ seen: false });
});

describe('<WelcomeScreen />', () => {
  it('montre les trois plans du produit', () => {
    render(<WelcomeScreen />);

    expect(screen.getByTestId('welcome-screen')).toBeTruthy();
    expect(screen.getByTestId('welcome-panel-carte')).toBeTruthy();
    expect(screen.getByTestId('welcome-panel-jeux')).toBeTruthy();
    expect(screen.getByTestId('welcome-panel-chasse')).toBeTruthy();
    // Les scènes animées sont là, pas seulement leurs titres.
    expect(screen.getByTestId('welcome-pacman')).toBeTruthy();
    expect(screen.getByTestId('welcome-hub')).toBeTruthy();
  });

  it('« Commencer » marque l’accueil vu et enchaîne sur l’onboarding', () => {
    render(<WelcomeScreen />);
    fireEvent.press(screen.getByTestId('welcome-start'));

    expect(useWelcomeStore.getState().seen).toBe(true);
    // Pas `/` : passer par la boutique ferait clignoter l’accueil avant que la
    // porte du layout ne renvoie sur l’onboarding.
    expect(mockReplace).toHaveBeenCalledWith('/onboarding');
  });

  it('« Passer » saute l’intro mais pas la personnalisation', () => {
    render(<WelcomeScreen />);
    fireEvent.press(screen.getByTestId('welcome-skip'));

    expect(useWelcomeStore.getState().seen).toBe(true);
    expect(mockReplace).toHaveBeenCalledWith('/onboarding');
  });

  it('« Se connecter » mène à la connexion, sans revoir l’intro ensuite', () => {
    render(<WelcomeScreen />);
    fireEvent.press(screen.getByTestId('welcome-signin'));

    expect(useWelcomeStore.getState().seen).toBe(true);
    expect(mockReplace).toHaveBeenCalledWith('/sign-in');
  });
});
