import { act, fireEvent, render, screen } from '@/shared/testing/render';

import { useWelcomeStore } from '../model/store';
import {
  FIRST_FRAME_TIMEOUT_MS,
  OPENING_MS,
  SPLASH_MS,
  STILL_MS,
  TAGLINE_AT_MS,
  WelcomeScreen,
} from '../ui/welcome-screen';

// « Réduire les animations », piloté par test (désactivé par défaut, comme sur un téléphone neuf).
let mockReducedMotion = false;
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual<{ default: unknown }>('react-native-reanimated');
  return {
    ...actual,
    __esModule: true,
    default: actual.default,
    useReducedMotion: () => mockReducedMotion,
  };
});

beforeEach(() => {
  jest.useFakeTimers();
  mockReducedMotion = false;
  useWelcomeStore.setState({ seen: false, splashDone: false });
});
afterEach(() => jest.useRealTimers());

/** Le lecteur natif annonce sa première image (sous Jest, `VideoView` est une simple vue). */
const firstFrame = () => fireEvent(screen.getByTestId('welcome-video'), 'firstFrameRender');

describe('<WelcomeScreen /> — l’ouverture en 3D', () => {
  it('montre le logo et ne demande rien : ni bouton, ni lien', () => {
    render(<WelcomeScreen onDone={jest.fn()} />);
    expect(screen.getByTestId('welcome-screen')).toBeTruthy();
    expect(screen.getByTestId('welcome-logo')).toBeTruthy();
    expect(screen.getByTestId('welcome-video')).toBeTruthy();
    expect(screen.queryByTestId('welcome-start')).toBeNull();
    expect(screen.queryByTestId('welcome-skip')).toBeNull();
  });

  it('la séquence jouée, passe tout seul à la suite — une seule fois', () => {
    const onDone = jest.fn();
    render(<WelcomeScreen onDone={onDone} />);
    act(() => firstFrame());
    act(() => {
      jest.advanceTimersByTime(SPLASH_MS - 50);
    });
    expect(onDone).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('la vidéo ne démarre pas : l’image finale prend sa place, et l’app continue', () => {
    const onDone = jest.fn();
    render(<WelcomeScreen onDone={onDone} />);
    act(() => {
      jest.advanceTimersByTime(FIRST_FRAME_TIMEOUT_MS);
    });
    expect(screen.queryByTestId('welcome-video')).toBeNull();
    expect(onDone).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(STILL_MS);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('« réduire les animations » : pas de vidéo, l’image finale, puis la suite', () => {
    mockReducedMotion = true;
    const onDone = jest.fn();
    render(<WelcomeScreen onDone={onDone} />);
    expect(screen.queryByTestId('welcome-video')).toBeNull();
    act(() => {
      jest.advanceTimersByTime(STILL_MS);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('marque l’accueil comme vu', () => {
    render(<WelcomeScreen onDone={jest.fn()} />);
    expect(useWelcomeStore.getState().seen).toBe(true);
  });

  it('la signature arrive après le trait de lumière, avant la fin', () => {
    // La lumière passe d'abord (le vœu du client), le texte ensuite ; et l'ouverture reste brève :
    // elle se rejoue à chaque lancement.
    expect(TAGLINE_AT_MS).toBeGreaterThan(OPENING_MS / 2);
    expect(TAGLINE_AT_MS).toBeLessThan(OPENING_MS);
    expect(SPLASH_MS).toBeLessThanOrEqual(2600);
  });
});
