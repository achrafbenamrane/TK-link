// expo-image tire un module natif inutile ici : on le remplace par un rendu nul.
import { fireEvent, render, screen } from '@/shared/testing/render';

import type { CardImage } from '../model/memory';
import { MemoryGame } from '../ui/memory-game';

jest.mock('expo-image', () => ({ Image: () => null }));

/**
 * Rendu réel du jeu de mémoire : les `testID` des cartes sont déterministes
 * (`card-<imageId>-a` / `-b`), donc on retourne chaque paire malgré le mélange.
 */
const IMAGES: CardImage[] = [
  { id: 'x', source: 1 },
  { id: 'y', source: 2 },
  { id: 'z', source: 3 },
];

describe('<MemoryGame />', () => {
  it('gagne en retrouvant les trois paires et signale la victoire', () => {
    const onWin = jest.fn();
    render(<MemoryGame images={IMAGES} onWin={onWin} onExit={jest.fn()} />);

    for (const im of ['x', 'y', 'z']) {
      fireEvent.press(screen.getByTestId(`card-${im}-a`));
      fireEvent.press(screen.getByTestId(`card-${im}-b`));
    }

    expect(screen.getByTestId('memory-result')).toBeOnTheScreen();
    expect(onWin).toHaveBeenCalledTimes(1);
  });
});
