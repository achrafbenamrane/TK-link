// Filet anti-crash pour les trois nouveaux jeux : on les monte et on déclenche
// une interaction de base. La logique est couverte par morpion/maze/wordsearch.test.
import { fireEvent, render, screen } from '@/shared/testing/render';

import type { CardImage } from '../model/memory';
import { MazeGame } from '../ui/maze-game';
import { MorpionGame } from '../ui/morpion-game';
import { WordSearchGame } from '../ui/wordsearch-game';

jest.mock('expo-image', () => ({ Image: () => null }));

const IMAGES: CardImage[] = [
  { id: 'a', source: 1 },
  { id: 'b', source: 2 },
];

describe('smoke — nouveaux jeux montent et réagissent', () => {
  it('MorpionGame : montage + un coup joué', () => {
    render(<MorpionGame images={IMAGES} onWin={jest.fn()} onExit={jest.fn()} />);
    fireEvent.press(screen.getByTestId('morpion-cell-0'));
    expect(screen.toJSON()).toBeTruthy();
  });

  it('MazeGame : montage + un déplacement', () => {
    render(<MazeGame goalImage={IMAGES[0]!} onWin={jest.fn()} onExit={jest.fn()} />);
    fireEvent.press(screen.getByTestId('maze-right'));
    fireEvent.press(screen.getByTestId('maze-down'));
    expect(screen.toJSON()).toBeTruthy();
  });

  it('WordSearchGame : montage + une sélection', () => {
    render(
      <WordSearchGame words={['PIZZA', 'SUSHI', 'SALADE']} onWin={jest.fn()} onExit={jest.fn()} />,
    );
    fireEvent.press(screen.getByTestId('ws-cell-0'));
    fireEvent.press(screen.getByTestId('ws-cell-1'));
    expect(screen.toJSON()).toBeTruthy();
  });
});
