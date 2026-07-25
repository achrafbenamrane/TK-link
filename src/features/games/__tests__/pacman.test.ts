import {
  allReachable,
  newPacGame,
  openDir,
  tick,
  type Ghost,
  type PacGame,
  type Walls,
} from '../model/pacman';

/** Grille SANS murs internes (seulement le bord) — mouvement libre pour tester. */
function openGrid(cols: number, rows: number): Walls[] {
  return Array.from({ length: cols * rows }, (_, i) => {
    const c = i % cols;
    const r = (i / cols) | 0;
    return { t: r === 0, r: c === cols - 1, b: r === rows - 1, l: c === 0 };
  });
}

function mkGame(cols: number, rows: number, over: Partial<PacGame> = {}): PacGame {
  const eaten = Array<boolean>(cols * rows).fill(false);
  return {
    cols,
    rows,
    walls: openGrid(cols, rows),
    pac: { c: cols >> 1, r: rows >> 1, dx: 0, dy: 0 },
    ghosts: [],
    eaten,
    food: [],
    dotsLeft: cols * rows - 1,
    lives: 3,
    frame: 0,
    status: 'playing',
    ...over,
  };
}

const RIGHT = { dx: 1, dy: 0 };
const NONE = { dx: 0, dy: 0 };

describe('newPacGame', () => {
  it('respecte les invariants et reste jouable', () => {
    for (let n = 0; n < 20; n++) {
      const g = newPacGame();
      expect(g.walls).toHaveLength(g.cols * g.rows);
      expect(g.dotsLeft).toBe(g.cols * g.rows - 1);
      expect(g.lives).toBe(3);
      expect(g.ghosts).toHaveLength(3);
      expect(g.status).toBe('playing');
      expect(allReachable(g)).toBe(true); // labyrinthe entièrement parcourable
    }
  });
});

describe('allReachable — oracle non trivial', () => {
  it('détecte une case murée (peut renvoyer false)', () => {
    const g = mkGame(3, 3);
    const last = 8; // (2,2)
    g.walls[last] = { t: true, r: true, b: true, l: true };
    g.walls[5]!.b = true; // voisin du dessus ferme vers le bas
    g.walls[7]!.r = true; // voisin de gauche ferme vers la droite
    expect(allReachable(g)).toBe(false);
  });
});

describe('tick — déplacement & repas', () => {
  it('avance dans la direction voulue si c’est ouvert et mange la case', () => {
    const g = mkGame(3, 1); // cases (0,0)(1,0)(2,0), pac au centre (1,0)
    const g2 = tick(g, RIGHT);
    expect(g2.pac.c).toBe(2);
    expect(g2.eaten[2]).toBe(true);
    expect(g2.dotsLeft).toBe(g.dotsLeft - 1);
  });

  it('s’arrête contre un mur (ne traverse pas le bord)', () => {
    const g = mkGame(3, 1, { pac: { c: 2, r: 0, dx: 0, dy: 0 } });
    const g2 = tick(g, RIGHT); // (2,0) a un mur à droite (bord)
    expect(g2.pac.c).toBe(2);
  });

  it('ne recompte pas une case déjà mangée', () => {
    const g = mkGame(3, 1);
    const g2 = tick(g, RIGHT); // mange (2,0)
    const g3 = tick(g2, NONE); // n’avance plus, reste sur (2,0)
    expect(g3.dotsLeft).toBe(g2.dotsLeft);
  });
});

describe('tick — victoire', () => {
  it('gagne quand la dernière case est mangée', () => {
    const eaten = [true, true, false]; // reste (2,0)
    const g = mkGame(3, 1, { pac: { c: 1, r: 0, dx: 0, dy: 0 }, eaten, dotsLeft: 1 });
    const g2 = tick(g, RIGHT);
    expect(g2.status).toBe('won');
    expect(g2.dotsLeft).toBe(0);
  });
});

describe('tick — fantômes & vies', () => {
  it('perd une vie quand le perso entre sur un fantôme', () => {
    // frame 0 → les fantômes ne bougent pas (0 % 3 === 0)
    const ghost: Ghost = { c: 2, r: 0, dx: 0, dy: 0 };
    const g = mkGame(3, 1, { pac: { c: 1, r: 0, dx: 0, dy: 0 }, ghosts: [ghost], frame: 0 });
    const g2 = tick(g, RIGHT); // pac entre sur (2,0) = le fantôme
    expect(g2.lives).toBe(2);
    expect(g2.status).toBe('playing');
    // pac replacé au centre après la prise
    expect(g2.pac.c).toBe(1);
  });

  it('perd la partie à la dernière vie', () => {
    const ghost: Ghost = { c: 2, r: 0, dx: 0, dy: 0 };
    const g = mkGame(3, 1, {
      pac: { c: 1, r: 0, dx: 0, dy: 0 },
      ghosts: [ghost],
      frame: 0,
      lives: 1,
    });
    const g2 = tick(g, RIGHT);
    expect(g2.status).toBe('lost');
  });
});

describe('tick — pureté', () => {
  it('n’altère pas l’état d’entrée', () => {
    const g = mkGame(3, 1);
    const beforeEaten = g.eaten.slice();
    const beforePac = { ...g.pac };
    tick(g, RIGHT);
    expect(g.eaten).toEqual(beforeEaten);
    expect(g.pac).toEqual(beforePac);
  });
});

describe('openDir', () => {
  it('lit correctement les murs', () => {
    const walls = openGrid(3, 1);
    expect(openDir(walls, 3, 0, 0, -1, 0)).toBe(false); // bord gauche fermé
    expect(openDir(walls, 3, 0, 0, 1, 0)).toBe(true); // vers la droite ouvert
  });
});
