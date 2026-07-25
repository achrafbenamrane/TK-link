import { newWordSearch, selectLine, straightLine, type WordSearch } from '../model/wordsearch';

/**
 * Grille déterministe, construite à la main (on ne dépend PAS du placement
 * aléatoire pour tester la sélection/victoire). Taille 4×4 :
 *
 *   0:C 1:A 2:T 3:Z
 *   4:D 5:Z 6:Z 7:Z
 *   8:O 9:Z 10:Z 11:Z
 *  12:G 13:Z 14:Z 15:Z
 *
 * « CAT » à l'horizontale (0,1,2) ; « DOG » à la verticale (4,8,12).
 */
function fixedGame(): WordSearch {
  const grid = ['C', 'A', 'T', 'Z', 'D', 'Z', 'Z', 'Z', 'O', 'Z', 'Z', 'Z', 'G', 'Z', 'Z', 'Z'];
  return {
    size: 4,
    grid,
    placed: [
      { word: 'CAT', cells: [0, 1, 2] },
      { word: 'DOG', cells: [4, 8, 12] },
    ],
    found: [],
    status: 'playing',
  };
}

/**
 * Grille déterministe avec deux mots en DIAGONALE. Taille 4×4 :
 *
 *   0:S 1:Z 2:Z 3:I
 *   4:Z 5:U 6:C 7:Z
 *   8:Z 9:E 10:N 11:Z
 *  12:Z 13:Z 14:Z 15:Z
 *
 * « SUN » en diagonale ↘ (0,5,10) ; « ICE » en diagonale ↙ (3,6,9).
 */
function fixedDiagonalGame(): WordSearch {
  const grid = ['S', 'Z', 'Z', 'I', 'Z', 'U', 'C', 'Z', 'Z', 'E', 'N', 'Z', 'Z', 'Z', 'Z', 'Z'];
  return {
    size: 4,
    grid,
    placed: [
      { word: 'SUN', cells: [0, 5, 10] },
      { word: 'ICE', cells: [3, 6, 9] },
    ],
    found: [],
    status: 'playing',
  };
}

describe('straightLine', () => {
  it('renvoie les indices contigus d’une sélection horizontale', () => {
    expect(straightLine(4, 0, 2)).toEqual([0, 1, 2]);
  });

  it('renvoie les indices contigus d’une sélection verticale', () => {
    expect(straightLine(4, 4, 12)).toEqual([4, 8, 12]);
  });

  it('renvoie l’ordre inverse quand on part de l’arrivée', () => {
    expect(straightLine(4, 2, 0)).toEqual([2, 1, 0]);
  });

  it('renvoie les indices d’une diagonale descendante-droite (↘)', () => {
    // (0,0) → (3,3) : pas de +(size+1)
    expect(straightLine(4, 0, 15)).toEqual([0, 5, 10, 15]);
  });

  it('renvoie les indices d’une diagonale descendante-gauche (↙)', () => {
    // (0,3) → (3,0) : pas de +(size-1)
    expect(straightLine(4, 3, 12)).toEqual([3, 6, 9, 12]);
  });

  it('renvoie l’ordre inverse d’une diagonale quand on part de l’arrivée', () => {
    expect(straightLine(4, 15, 0)).toEqual([15, 10, 5, 0]);
  });

  it('renvoie null pour deux cases non alignées (saut de cavalier)', () => {
    // (0,0) → (1,2) : |Δligne|=1 ≠ |Δcolonne|=2
    expect(straightLine(4, 0, 6)).toBeNull();
  });

  it('renvoie [from] pour une case seule', () => {
    expect(straightLine(4, 5, 5)).toEqual([5]);
  });

  it('renvoie null pour un indice hors bornes', () => {
    expect(straightLine(4, -1, 0)).toBeNull();
    expect(straightLine(4, 0, 16)).toBeNull();
    expect(straightLine(4, 16, 0)).toBeNull();
  });
});

describe('selectLine', () => {
  it('trouve un mot en sélectionnant exactement ses cases', () => {
    const g = selectLine(fixedGame(), 0, 2);
    expect(g.found).toEqual(['CAT']);
    expect(g.status).toBe('playing');
  });

  it('trouve un mot même en le sélectionnant à l’envers', () => {
    const g = selectLine(fixedGame(), 2, 0); // T → A → C
    expect(g.found).toEqual(['CAT']);
  });

  it('trouve le mot vertical', () => {
    const g = selectLine(fixedGame(), 4, 12);
    expect(g.found).toEqual(['DOG']);
  });

  it('trouve un mot en diagonale ↘', () => {
    const g = selectLine(fixedDiagonalGame(), 0, 10); // S → U → N
    expect(g.found).toEqual(['SUN']);
  });

  it('trouve un mot en diagonale ↙', () => {
    const g = selectLine(fixedDiagonalGame(), 3, 9); // I → C → E
    expect(g.found).toEqual(['ICE']);
  });

  it('trouve un mot en diagonale même sélectionné à l’envers', () => {
    const g = selectLine(fixedDiagonalGame(), 10, 0); // N → U → S
    expect(g.found).toEqual(['SUN']);
  });

  it('gagne une fois tous les mots placés trouvés', () => {
    let g = fixedGame();
    g = selectLine(g, 0, 2); // CAT
    expect(g.status).toBe('playing');
    g = selectLine(g, 12, 4); // DOG à l’envers
    expect(g.found).toEqual(['CAT', 'DOG']);
    expect(g.status).toBe('won');
  });

  it('gagne en trouvant les deux mots diagonaux', () => {
    let g = fixedDiagonalGame();
    g = selectLine(g, 0, 10); // SUN ↘
    expect(g.status).toBe('playing');
    g = selectLine(g, 9, 3); // ICE ↙ à l’envers
    expect(g.found).toEqual(['SUN', 'ICE']);
    expect(g.status).toBe('won');
  });

  it('renvoie la partie inchangée sur une sélection non concordante', () => {
    const g = fixedGame();
    const after = selectLine(g, 13, 15); // ligne valide mais aucun mot
    expect(after).toBe(g);
  });

  it('renvoie la partie inchangée sur une diagonale non concordante', () => {
    const g = fixedGame();
    // (0,0) → (1,1) : diagonale valide mais « CZ » ne correspond à aucun mot
    expect(selectLine(g, 0, 5)).toBe(g);
  });

  it('ignore une sélection répétée d’un mot déjà trouvé', () => {
    const found = selectLine(fixedGame(), 0, 2);
    const again = selectLine(found, 0, 2);
    expect(again).toBe(found);
  });

  it('ne valide pas une sélection partielle d’un mot', () => {
    const g = fixedGame();
    // [0,1] = « CA », sous-ensemble de CAT [0,1,2] : ne doit pas compter
    expect(selectLine(g, 0, 1)).toBe(g);
  });

  it('ne valide pas une sélection qui déborde un mot', () => {
    const g = fixedGame();
    // [0,1,2,3] ⊃ CAT [0,1,2] : la ligne est droite mais ne correspond à aucun mot
    expect(selectLine(g, 0, 3)).toBe(g);
  });
});

describe('newWordSearch — placement auto-cohérent', () => {
  it('place chaque mot de sorte que lire ses cases redonne le mot', () => {
    const words = ['chat', 'chien', 'oiseau', 'poisson'];
    for (let i = 0; i < 25; i++) {
      const g = newWordSearch(words);
      // taille par défaut = max(plus long mot, 10) ; ici POISSON = 7 → 10
      expect(g.size).toBe(10);
      expect(g.grid).toHaveLength(g.size * g.size);
      expect(g.grid.every((ch) => /^[A-Z]$/.test(ch))).toBe(true);
      expect(g.status).toBe('playing');
      expect(g.found).toEqual([]);
      expect(g.placed.length).toBeGreaterThan(0);

      for (const p of g.placed) {
        const read = p.cells.map((c) => g.grid[c]).join('');
        expect(read).toBe(p.word);
        expect(p.cells.every((c) => c >= 0 && c < g.size * g.size)).toBe(true);
        // chaque case sélectionnée doit se relire via une vraie ligne droite
        const first = p.cells[0]!;
        const last = p.cells[p.cells.length - 1]!;
        expect(straightLine(g.size, first, last)).toEqual(p.cells);
      }
    }
  });

  it('normalise les mots (majuscules, sans accents ni espaces)', () => {
    const g = newWordSearch(['Éléphant', 'crème brûlée']);
    for (const p of g.placed) {
      expect(p.word).toMatch(/^[A-Z]+$/);
    }
    const words = g.placed.map((p) => p.word);
    // « Éléphant » → « ELEPHANT », « crème brûlée » → « CREMEBRULEE »
    expect(words.some((w) => w === 'ELEPHANT' || w === 'CREMEBRULEE')).toBe(true);
  });

  it('écarte les mots trop longs pour la grille', () => {
    const g = newWordSearch(['CAT', 'ELEPHANT'], 5); // ELEPHANT = 8 > 5
    expect(g.placed.every((p) => p.word.length <= 5)).toBe(true);
    expect(g.placed.some((p) => p.word === 'ELEPHANT')).toBe(false);
  });

  it('reste « playing » quand aucun mot n’est fourni', () => {
    const g = newWordSearch([]);
    expect(g.placed).toEqual([]);
    expect(g.status).toBe('playing');
    expect(g.grid).toHaveLength(g.size * g.size);
  });

  it('utilise réellement les diagonales (la propriété de difficulté)', () => {
    // Le placement auto-cohérent ci-dessus passerait même si le moteur ne posait
    // QUE des mots H/V. On garde donc explicitement la nouvelle difficulté :
    // sur un grand nombre de grilles, au moins un mot doit être posé en diagonale
    // (Δligne ≠ 0 ET Δcolonne ≠ 0 entre deux cases consécutives). Non-flaky :
    // ~4 mots × 40 grilles, chaque direction ~équiprobable parmi 4.
    const words = ['CHAT', 'CHIEN', 'OISEAU', 'POISSON', 'LAPIN'];
    let diagonalPlacements = 0;
    for (let i = 0; i < 40; i++) {
      const g = newWordSearch(words);
      for (const p of g.placed) {
        const a = p.cells[0]!;
        const b = p.cells[1]!; // tous ces mots font ≥ 4 lettres
        const dr = Math.floor(b / g.size) - Math.floor(a / g.size);
        const dc = (b % g.size) - (a % g.size);
        if (dr !== 0 && dc !== 0) diagonalPlacements++;
      }
    }
    expect(diagonalPlacements).toBeGreaterThan(0);
  });
});
