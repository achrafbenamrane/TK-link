import {
  dismiss,
  flipCard,
  isMismatchPending,
  isRevealed,
  newGame,
  triesLeft,
  type CardImage,
  type MemoryGame,
} from '../model/memory';

const POOL: CardImage[] = [
  { id: 'a', source: 1 },
  { id: 'b', source: 2 },
  { id: 'c', source: 3 },
  { id: 'd', source: 4 },
  { id: 'e', source: 5 },
];

/** Partie déterministe (on ne dépend pas du mélange pour tester la logique). */
function fixedGame(pairs = 3, maxMistakes = 3): MemoryGame {
  const cards = ['a', 'b', 'c'].flatMap((im, i) => [
    { id: `${im}-a`, imageId: im, source: i + 1 },
    { id: `${im}-b`, imageId: im, source: i + 1 },
  ]);
  return { cards, matched: [], flipped: [], mistakes: 0, maxMistakes, pairs, status: 'playing' };
}

describe('newGame', () => {
  it('crée deux cartes par paire, bien mélangées', () => {
    const g = newGame(POOL, 3);
    expect(g.cards).toHaveLength(6);
    expect(g.pairs).toBe(3);
    // chaque imageId apparaît exactement deux fois
    const counts = g.cards.reduce<Record<string, number>>((m, c) => {
      m[c.imageId] = (m[c.imageId] ?? 0) + 1;
      return m;
    }, {});
    expect(Object.values(counts).every((n) => n === 2)).toBe(true);
  });

  it('ne demande jamais plus de paires que le pool', () => {
    expect(newGame([{ id: 'x', source: 1 }], 3).pairs).toBe(1);
  });
});

describe('flipCard — appariement', () => {
  it('révèle une carte, puis garde une paire trouvée', () => {
    let g = fixedGame();
    g = flipCard(g, 'a-a');
    expect(
      isRevealed(
        g,
        g.cards.find((c) => c.id === 'a-a')!,
      ),
    ).toBe(true);
    g = flipCard(g, 'a-b');
    expect(g.matched).toContain('a');
    expect(g.flipped).toEqual([]);
    expect(g.mistakes).toBe(0);
  });

  it('gagne une fois les trois paires trouvées', () => {
    let g = fixedGame();
    for (const im of ['a', 'b', 'c']) {
      g = flipCard(g, `${im}-a`);
      g = flipCard(g, `${im}-b`);
    }
    expect(g.status).toBe('won');
  });
});

describe('flipCard — erreurs et défaite', () => {
  it('compte une erreur sur une mauvaise paire', () => {
    let g = fixedGame();
    g = flipCard(g, 'a-a');
    g = flipCard(g, 'b-a');
    expect(g.mistakes).toBe(1);
    expect(isMismatchPending(g)).toBe(true);
    expect(triesLeft(g)).toBe(2);
  });

  it('perd à la 3ᵉ erreur', () => {
    let g = fixedGame(3, 3);
    for (const [x, y] of [
      ['a-a', 'b-a'],
      ['a-a', 'c-a'],
      ['b-a', 'c-a'],
    ] as const) {
      g = dismiss(g);
      g = flipCard(g, x);
      g = flipCard(g, y);
    }
    expect(g.status).toBe('lost');
    expect(triesLeft(g)).toBe(0);
  });

  it('dismiss referme les cartes d’une erreur', () => {
    let g = fixedGame();
    g = flipCard(g, 'a-a');
    g = flipCard(g, 'b-a');
    g = dismiss(g);
    expect(g.flipped).toEqual([]);
  });
});

describe('flipCard — coups impossibles ignorés', () => {
  it('ignore une 3ᵉ carte tant que l’erreur n’est pas résolue', () => {
    let g = fixedGame();
    g = flipCard(g, 'a-a');
    g = flipCard(g, 'b-a'); // erreur, 2 retournées
    const before = g;
    g = flipCard(g, 'c-a'); // doit être ignorée
    expect(g).toBe(before);
  });

  it('ignore une carte déjà trouvée et une partie finie', () => {
    let g = fixedGame();
    g = flipCard(g, 'a-a');
    g = flipCard(g, 'a-b'); // paire a trouvée
    const after = flipCard(g, 'a-a'); // déjà appariée
    expect(after).toBe(g);

    const won = { ...g, status: 'won' as const };
    expect(flipCard(won, 'b-a')).toBe(won);
  });
});
