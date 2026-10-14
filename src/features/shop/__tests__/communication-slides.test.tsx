import { Dimensions } from 'react-native';

import { fireEvent, render, screen } from '@/shared/testing/render';

import { SLIDES } from '../lib/communication';
import { CommunicationSlides } from '../ui/components/communication-slides';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

describe('<CommunicationSlides />', () => {
  it('montre toutes les diapositives et un point par diapositive, la première active', () => {
    render(<CommunicationSlides />);
    for (const slide of SLIDES) {
      expect(screen.getByTestId(`home-slide-${slide.id}`)).toBeOnTheScreen();
    }
    expect(screen.getAllByTestId(/^home-slide-dot-/)).toHaveLength(SLIDES.length);
    expect(screen.getByTestId('home-slide-dot-0').props.accessibilityState.selected).toBe(true);
  });

  it('le point actif suit le défilement', () => {
    render(<CommunicationSlides />);
    const scroll = screen.getByLabelText('Informations TK LINK');
    // La largeur de la fenêtre sous Jest : on défile d'une page entière.
    const { width } = Dimensions.get('window');
    fireEvent(scroll, 'momentumScrollEnd', { nativeEvent: { contentOffset: { x: width } } });
    expect(screen.getByTestId('home-slide-dot-1').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('home-slide-dot-0').props.accessibilityState.selected).toBe(false);
  });

  it('ne promet que ce que l’app fait : le parrainage vaut la récompense du cahier des charges', () => {
    const parrainage = SLIDES.find((s) => s.id === 'parrainage')!;
    expect(parrainage.title).toMatch(/5 €/);
    expect(parrainage.href).toBe('/parrainage');
  });
});
