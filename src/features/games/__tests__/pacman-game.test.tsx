// Filet anti-crash : on monte PacFreedoo (SVG + gesture-handler + reanimated).
import { render, screen } from '@/shared/testing/render';

import type { CardImage } from '../model/memory';
import { FoodLayer, PacmanGame } from '../ui/pacman-game';

jest.mock('expo-image', () => ({ Image: () => null }));

const IMAGES: CardImage[] = [
  { id: 'a', source: 1 },
  { id: 'b', source: 2 },
];

describe('<PacmanGame />', () => {
  it('monte sans planter', () => {
    render(<PacmanGame images={IMAGES} onWin={jest.fn()} onExit={jest.fn()} />);
    expect(screen.toJSON()).toBeTruthy();
  });
});

// L'invariant fragile du refactor perf : `eatenKey[k]` doit cacher EXACTEMENT
// `food[k]`. Un décalage d'index masquerait la mauvaise photo d'offre en silence.
describe('<FoodLayer /> — alignement mangé ↔ photo', () => {
  it('cache exactement la food mangée, garde les autres', () => {
    render(<FoodLayer food={[5, 12, 20]} images={IMAGES} eatenKey="010" cell={24} />);
    expect(screen.getByTestId('pacman-food-5')).toBeTruthy(); // eatenKey[0] = 0 → visible
    expect(screen.queryByTestId('pacman-food-12')).toBeNull(); // eatenKey[1] = 1 → cachée
    expect(screen.getByTestId('pacman-food-20')).toBeTruthy(); // eatenKey[2] = 0 → visible
  });

  it('affiche toutes les photos quand rien n’est mangé', () => {
    render(<FoodLayer food={[5, 12, 20]} images={IMAGES} eatenKey="000" cell={24} />);
    expect(screen.getByTestId('pacman-food-5')).toBeTruthy();
    expect(screen.getByTestId('pacman-food-12')).toBeTruthy();
    expect(screen.getByTestId('pacman-food-20')).toBeTruthy();
  });
});
