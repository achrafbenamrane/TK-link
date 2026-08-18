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
