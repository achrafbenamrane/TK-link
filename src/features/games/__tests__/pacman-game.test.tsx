// Filet anti-crash : on monte PacFreedoo (SVG + gesture-handler + reanimated).
import { render, screen } from '@/shared/testing/render';

import type { CardImage } from '../model/memory';
import { PacmanGame } from '../ui/pacman-game';

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
