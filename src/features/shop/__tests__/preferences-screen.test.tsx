import { fireEvent, render, screen } from '@/shared/testing/render';

import { DEFAULT_PREFERENCES } from '../lib/preferences';
import { useShopStore } from '../model/store';
import { PreferencesScreen } from '../ui/preferences-screen';

beforeEach(() => {
  useShopStore.setState({ preferences: DEFAULT_PREFERENCES });
});

describe('<PreferencesScreen />', () => {
  it('n’enregistre RIEN tant qu’on n’a pas appliqué', () => {
    render(<PreferencesScreen onDone={jest.fn()} />);
    fireEvent.press(screen.getByTestId('pref-style-vegan'));
    fireEvent.press(screen.getByTestId('pref-radius-10'));
    // Le brouillon a changé, le store non.
    expect(useShopStore.getState().preferences).toEqual(DEFAULT_PREFERENCES);
  });

  it('applique le brouillon et ferme', () => {
    const onDone = jest.fn();
    render(<PreferencesScreen onDone={onDone} />);

    fireEvent.press(screen.getByTestId('pref-style-vegan'));
    fireEvent.press(screen.getByTestId('pref-style-halal'));
    fireEvent.press(screen.getByTestId('pref-radius-10'));
    fireEvent.press(screen.getByTestId('pref-collect-livraison'));
    fireEvent.press(screen.getByTestId('pref-apply'));

    expect(useShopStore.getState().preferences).toEqual({
      collect: 'livraison',
      radiusKm: 10,
      lifestyle: ['vegan', 'halal'],
    });
    expect(onDone).toHaveBeenCalled();
  });

  it('un second tap retire le régime', () => {
    render(<PreferencesScreen onDone={jest.fn()} />);
    fireEvent.press(screen.getByTestId('pref-style-vegan'));
    fireEvent.press(screen.getByTestId('pref-style-vegan'));
    fireEvent.press(screen.getByTestId('pref-apply'));
    expect(useShopStore.getState().preferences.lifestyle).toEqual([]);
  });

  it('« Retour » n’applique pas', () => {
    const onDone = jest.fn();
    render(<PreferencesScreen onDone={onDone} />);
    fireEvent.press(screen.getByTestId('pref-style-vegan'));
    fireEvent.press(screen.getByTestId('pref-back'));
    expect(useShopStore.getState().preferences).toEqual(DEFAULT_PREFERENCES);
    expect(onDone).toHaveBeenCalled();
  });

  it('repart des préférences déjà enregistrées', () => {
    useShopStore.setState({
      preferences: { collect: 'touch-collect', radiusKm: 5, lifestyle: ['halal'] },
    });
    render(<PreferencesScreen onDone={jest.fn()} />);
    // Appliquer sans rien toucher ne doit rien perdre.
    fireEvent.press(screen.getByTestId('pref-apply'));
    expect(useShopStore.getState().preferences).toEqual({
      collect: 'touch-collect',
      radiusKm: 5,
      lifestyle: ['halal'],
    });
  });
});
