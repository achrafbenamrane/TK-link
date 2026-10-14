import { act, render, screen } from '@/shared/testing/render';

import { useWelcomeStore } from '../model/store';
import { BOLT_LEAD_MS, SPLASH_MS, WelcomeScreen } from '../ui/welcome-screen';

beforeEach(() => {
  jest.useFakeTimers();
  useWelcomeStore.setState({ seen: false, splashDone: false });
});
afterEach(() => jest.useRealTimers());

describe('<WelcomeScreen /> — le logo animé', () => {
  it('montre le logo et ne demande rien : ni bouton, ni lien', () => {
    render(<WelcomeScreen onDone={jest.fn()} />);
    expect(screen.getByTestId('welcome-screen')).toBeTruthy();
    expect(screen.getByTestId('welcome-logo')).toBeTruthy();
    expect(screen.queryByTestId('welcome-start')).toBeNull();
    expect(screen.queryByTestId('welcome-skip')).toBeNull();
  });

  it('passe tout seul à la suite une fois l’animation jouée', () => {
    const onDone = jest.fn();
    render(<WelcomeScreen onDone={onDone} />);
    expect(onDone).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(SPLASH_MS + 50);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('marque l’accueil comme vu', () => {
    render(<WelcomeScreen onDone={jest.fn()} />);
    expect(useWelcomeStore.getState().seen).toBe(true);
  });

  it('un éclair frappe avant le logo : il a de l’avance sur le texte', () => {
    render(<WelcomeScreen onDone={jest.fn()} />);
    expect(screen.getByTestId('welcome-bolt')).toBeTruthy();
    // L'éclair est plus bref que son avance : la lumière est passée avant que le logo n'apparaisse.
    expect(BOLT_LEAD_MS).toBeGreaterThan(0);
    expect(BOLT_LEAD_MS).toBeLessThan(SPLASH_MS / 2);
  });
});
