import { fireEvent, render, screen } from '@/shared/testing/render';

import type { QuizItem } from '../model/quiz';
import { QuizGame } from '../ui/quiz-game';

/**
 * Rendu réel du quiz : on pilote l'UI comme un joueur. Le tirage est aléatoire,
 * mais on répond de façon déterministe en lisant l'offre affichée à l'écran et
 * en pressant la proposition qui porte SON vrai prix (prix tous distincts).
 */
const POOL: QuizItem[] = [
  { id: 'a', title: 'Alpha', price: 10, emoji: '🥩' },
  { id: 'b', title: 'Bravo', price: 20, emoji: '🍕' },
  { id: 'c', title: 'Charlie', price: 30, emoji: '🧀' },
  { id: 'd', title: 'Delta', price: 40, emoji: '🍎' },
];

const eur = (v: number) => `${v.toFixed(2).replace('.', ',')} €`;

/** L'offre actuellement affichée (identifiée par son titre unique). */
function shownOffer(): QuizItem {
  const o = POOL.find((it) => screen.queryByText(it.title));
  if (!o) throw new Error('aucune offre affichée');
  return o;
}

describe('<QuizGame />', () => {
  it('gagne en répondant juste à toutes les questions', () => {
    const onWin = jest.fn();
    render(<QuizGame pool={POOL} onWin={onWin} onExit={jest.fn()} />);

    for (let i = 0; i < POOL.length; i++) {
      const offer = shownOffer();
      fireEvent.press(screen.getByText(eur(offer.price))); // bonne réponse
      fireEvent.press(screen.getByTestId('quiz-next'));
    }

    expect(screen.getByTestId('quiz-result')).toBeOnTheScreen();
    expect(screen.getByText(/Coupon débloqué/)).toBeOnTheScreen();
    expect(onWin).toHaveBeenCalledTimes(1);
  });

  it('perd en répondant faux, sans accorder de coupon', () => {
    const onWin = jest.fn();
    render(<QuizGame pool={POOL} onWin={onWin} onExit={jest.fn()} />);

    for (let i = 0; i < POOL.length; i++) {
      const offer = shownOffer();
      const wrong = POOL.map((o) => o.price).find((p) => p !== offer.price)!;
      fireEvent.press(screen.getByText(eur(wrong)));
      fireEvent.press(screen.getByTestId('quiz-next'));
    }

    expect(screen.getByTestId('quiz-result')).toBeOnTheScreen();
    expect(screen.getByText(/Presque/)).toBeOnTheScreen();
    expect(onWin).not.toHaveBeenCalled();
  });
});
