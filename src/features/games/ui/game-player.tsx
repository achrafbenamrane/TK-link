import type { CardImage } from '../model/memory';
import type { QuizItem } from '../model/quiz';
import type { GameKey } from '../model/tiles';
import { MazeGame } from './maze-game';
import { MemoryGame } from './memory-game';
import { MorpionGame } from './morpion-game';
import { PacmanGame } from './pacman-game';
import { QuizGame } from './quiz-game';
import { WordSearchGame } from './wordsearch-game';

type Props = {
  game: GameKey;
  /** Réservoir d'images, injecté par la route depuis les offres du catalogue. */
  imagePool: CardImage[];
  /** Offres (titre + prix) pour le quiz, injectées par la route. */
  quizPool: QuizItem[];
  /** Mots courts pour les mots mêlés. */
  words: string[];
  onWin: () => void;
  onExit: () => void;
};

/**
 * Ouvre UN jeu en plein écran, quelle que soit son origine (menu « Jeux » ou
 * rail du hub). C'est le seul endroit qui connaît la correspondance
 * clé → composant : ajouter un jeu se fait ici et dans `GAME_TILES`, nulle
 * part ailleurs.
 *
 * Renvoie `null` si le réservoir requis est vide — le labyrinthe sans image de
 * but n'a rien à afficher, et l'appelant a déjà verrouillé la tuile.
 */
export function GamePlayer({ game, imagePool, quizPool, words, onWin, onExit }: Props) {
  switch (game) {
    case 'memory':
      return <MemoryGame images={imagePool} onWin={onWin} onExit={onExit} />;
    case 'morpion':
      return <MorpionGame images={imagePool} onWin={onWin} onExit={onExit} />;
    case 'maze': {
      const goal = imagePool[0];
      return goal ? <MazeGame goalImage={goal} onWin={onWin} onExit={onExit} /> : null;
    }
    case 'wordsearch':
      return <WordSearchGame words={words} onWin={onWin} onExit={onExit} />;
    case 'quiz':
      return <QuizGame pool={quizPool} onWin={onWin} onExit={onExit} />;
    case 'pacman':
      return <PacmanGame images={imagePool} onWin={onWin} onExit={onExit} />;
  }
}
