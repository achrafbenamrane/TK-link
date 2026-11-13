/**
 * LE ROUTEUR FACTICE PAR DÉFAUT DES TESTS — une seule source.
 *
 * Un `jest.mock('expo-router', …)` local REMPLACE le mock global de `jest.setup.ts` en entier.
 * Le 13/11/2026, trois écrans ont adopté `useFocusEffect` (relire le serveur à chaque passage) et
 * quatorze fichiers de test ont cassé d’un coup : leurs mocks locaux ne l’avaient pas. Les mocks
 * locaux étalent donc ces valeurs par défaut AVANT leurs propres remplacements :
 *
 *   jest.mock('expo-router', () => ({
 *     ...require('@/shared/testing/expo-router-mock').expoRouterDefaults(),
 *     useRouter: () => ({ push: mockPush }),
 *   }));
 *
 * Une fonction d’`expo-router` qu’un écran se met à utiliser s’ajoute ICI, et tous les tests
 * l’ont.
 */
/* eslint-disable @typescript-eslint/no-require-imports -- why: appelé depuis des fabriques de jest.mock, qui ne capturent pas d’import */
export function expoRouterDefaults() {
  const React = require('react') as typeof import('react');
  return {
    useRouter: () => ({
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
      dismissAll: jest.fn(),
      canGoBack: () => true,
      canDismiss: () => false,
    }),
    useLocalSearchParams: () => ({}),
    useSegments: () => [],
    usePathname: () => '/',
    // Un écran « au premier plan » une fois monté : l'effet tourne au montage.
    useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]),
    Link: ({ children }: { children?: unknown }) => children,
  };
}
