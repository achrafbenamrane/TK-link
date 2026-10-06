/**
 * Global Jest setup. Keep this file small — feature-specific mocks belong
 * next to the feature's tests.
 */

/* eslint-disable @typescript-eslint/no-require-imports */

// Official AsyncStorage in-memory mock.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

/**
 * Lecteur vidéo : le module natif n'existe pas sous Jest. `useVideoPlayer` rend un lecteur factice
 * et `VideoView` une simple vue, assez pour vérifier qu'une vidéo est montée et lancée.
 */
jest.mock('expo-video', () => {
  const { View } = require('react-native');
  return {
    useVideoPlayer: (_source: unknown, setup?: (p: Record<string, unknown>) => void) => {
      const player = { loop: false, play: jest.fn(), pause: jest.fn() };
      setup?.(player);
      return player;
    },
    VideoView: View,
  };
});

/** Retour tactile : sans moteur de vibration sous Jest, on rend des fonctions vides. */
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

/**
 * Routeur par défaut.
 *
 * `BackButton` est désormais posé sur tous les écrans empilés — il tire donc
 * `expo-router` dans le graphe de n'importe quel test d'écran. Sans ce défaut,
 * chaque nouveau test devrait redéclarer le même mock, et on découvrirait
 * l'oubli par une suite qui refuse de démarrer plutôt que par un échec lisible.
 *
 * Les mocks locaux existants restent prioritaires : `jest.mock` dans un fichier
 * de test écrase celui-ci. `canGoBack` y manque souvent — c'est sans effet, il
 * n'est appelé qu'au moment du clic.
 */
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
  }),
  useLocalSearchParams: () => ({}),
}));

// Reanimated ships an official Jest integration (v3.6+ / v4).
require('react-native-reanimated').setUpTests();
