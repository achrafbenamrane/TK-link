import { fireEvent, render, screen } from '@/shared/testing/render';

import { playableGames } from '../model/tiles';
import { GamesRail } from '../ui/games-rail';

describe('playableGames', () => {
  it('verrouille les jeux sans matière', () => {
    const empty = playableGames({ images: 0, quiz: 0, words: 0 });
    expect(Object.values(empty).every((v) => v === false)).toBe(true);
  });

  it('ouvre le quiz seulement à partir de trois offres', () => {
    expect(playableGames({ images: 9, quiz: 2, words: 9 }).quiz).toBe(false);
    expect(playableGames({ images: 9, quiz: 3, words: 9 }).quiz).toBe(true);
  });
});

describe('<GamesRail />', () => {
  it('lance le jeu touché', () => {
    const onPlay = jest.fn();
    render(<GamesRail pools={{ images: 6, quiz: 6, words: 6 }} onPlay={onPlay} />);

    fireEvent.press(screen.getByTestId('games-rail-memory'));
    expect(onPlay).toHaveBeenCalledWith('memory');
  });

  it('ne lance rien quand le réservoir est vide', () => {
    const onPlay = jest.fn();
    render(<GamesRail onPlay={onPlay} />);

    fireEvent.press(screen.getByTestId('games-rail-memory'));
    expect(onPlay).not.toHaveBeenCalled();
  });
});
