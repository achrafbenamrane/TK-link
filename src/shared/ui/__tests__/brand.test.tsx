import { fireEvent, render, screen } from '@/shared/testing/render';
import { useThemeStore } from '@/shared/theme/theme-store';

import { ThemeToggle } from '../theme-toggle';
import { Wordmark } from '../wordmark';

describe('<Wordmark />', () => {
  it('se lit « TKlink » par les lecteurs d’écran, en deux mots visuels', () => {
    render(<Wordmark />);
    expect(screen.getByLabelText('TKlink')).toBeTruthy();
    expect(screen.getByText('TK')).toBeTruthy();
    expect(screen.getByText('link')).toBeTruthy();
  });
});

describe('<ThemeToggle /> — Nuit / Jour des maquettes', () => {
  beforeEach(() => {
    useThemeStore.setState({ mode: 'night' });
  });

  it('propose les deux modes, la Nuit étant active par défaut', () => {
    render(<ThemeToggle />);
    expect(screen.getByTestId('theme-toggle-night').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('theme-toggle-day').props.accessibilityState.selected).toBe(false);
  });

  it('fixe le mode choisi', () => {
    render(<ThemeToggle />);
    fireEvent.press(screen.getByTestId('theme-toggle-day'));
    expect(useThemeStore.getState().mode).toBe('day');
    expect(screen.getByTestId('theme-toggle-day').props.accessibilityState.selected).toBe(true);

    fireEvent.press(screen.getByTestId('theme-toggle-night'));
    expect(useThemeStore.getState().mode).toBe('night');
  });
});
