import {
  answerCurrent,
  correctCount,
  currentQuestion,
  isAnswered,
  newQuiz,
  next,
  passMarkFor,
  CHOICES_PER_QUESTION,
  type QuizGame,
  type QuizItem,
} from '../model/quiz';

const POOL: QuizItem[] = [
  { id: 'a', title: 'Côte', price: 24.9, emoji: '🥩' },
  { id: 'b', title: 'Pizza', price: 6.9, emoji: '🍕' },
  { id: 'c', title: 'Fromage', price: 12, emoji: '🧀' },
  { id: 'd', title: 'Fruits', price: 5.5, emoji: '🍎' },
  { id: 'e', title: 'Brunch', price: 15, emoji: '🥗' },
  { id: 'f', title: 'Légumes', price: 6.9, emoji: '🥦' }, // prix dupliqué exprès
];

/** Partie déterministe : deux questions au bon prix connu (pas de mélange). */
function fixedGame(passMark = 2): QuizGame {
  return {
    questions: [
      { id: 'a', title: 'Côte', emoji: '🥩', choices: [10, 24.9, 6.9], correctIndex: 1 },
      { id: 'b', title: 'Pizza', emoji: '🍕', choices: [6.9, 12, 5.5], correctIndex: 0 },
    ],
    current: 0,
    picks: [null, null],
    passMark,
    status: 'playing',
  };
}

describe('newQuiz', () => {
  it('crée une question par offre tirée, le bon prix parmi les choix', () => {
    const g = newQuiz(POOL, 4);
    expect(g.questions).toHaveLength(4);
    for (const q of g.questions) {
      const truth = POOL.find((d) => d.id === q.id)!.price;
      expect(q.choices[q.correctIndex]).toBe(truth);
      // pas plus de propositions que prévu, et toutes distinctes
      expect(q.choices.length).toBeLessThanOrEqual(CHOICES_PER_QUESTION);
      expect(new Set(q.choices).size).toBe(q.choices.length);
    }
  });

  it('ne demande jamais plus de questions que le pool', () => {
    expect(newQuiz(POOL.slice(0, 2), 5).questions).toHaveLength(2);
  });

  it('le seuil de réussite suit le nombre de questions (60 %)', () => {
    expect(passMarkFor(5)).toBe(3);
    expect(passMarkFor(4)).toBe(3);
    expect(passMarkFor(1)).toBe(1);
    expect(newQuiz(POOL, 5).passMark).toBe(3);
  });
});

describe('answerCurrent + next', () => {
  it('compte une bonne réponse et avance', () => {
    let g = fixedGame();
    g = answerCurrent(g, 1); // correct pour la Q0
    expect(isAnswered(g)).toBe(true);
    expect(correctCount(g)).toBe(1);
    g = next(g);
    expect(g.current).toBe(1);
    expect(currentQuestion(g)?.id).toBe('b');
  });

  it('ignore une seconde réponse à la même question', () => {
    let g = fixedGame();
    g = answerCurrent(g, 1); // correct
    const before = g;
    g = answerCurrent(g, 0); // doit être ignorée
    expect(g).toBe(before);
    expect(correctCount(g)).toBe(1);
  });

  it('gagne en atteignant le seuil', () => {
    let g = fixedGame(2);
    g = answerCurrent(g, 1); // Q0 correct
    g = next(g);
    g = answerCurrent(g, 0); // Q1 correct
    g = next(g); // clôture
    expect(g.status).toBe('won');
    expect(correctCount(g)).toBe(2);
  });

  it('perd sous le seuil', () => {
    let g = fixedGame(2);
    g = answerCurrent(g, 0); // Q0 faux
    g = next(g);
    g = answerCurrent(g, 1); // Q1 faux
    g = next(g);
    expect(g.status).toBe('lost');
    expect(correctCount(g)).toBe(0);
  });

  it('next sans réponse ne fait rien', () => {
    const g = fixedGame();
    expect(next(g)).toBe(g);
  });
});
