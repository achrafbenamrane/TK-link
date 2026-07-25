import { newMorpion, playAt, winningLine, SIZE, type Mark, type Morpion } from '../model/morpion';

/** Construit une partie « en cours » à partir d'un plateau donné. */
function game(board: (Mark | null)[]): Morpion {
  return { board, status: 'playing' };
}

const _ = null; // raccourci lisible pour une case vide

describe('newMorpion', () => {
  it('crée un plateau vide de 9 cases, à jouer', () => {
    const g = newMorpion();
    expect(g.board).toHaveLength(SIZE * SIZE);
    expect(g.board.every((c) => c === null)).toBe(true);
    expect(g.status).toBe('playing');
  });
});

describe('winningLine', () => {
  it('détecte une ligne', () => {
    // prettier-ignore
    expect(winningLine(['me', 'me', 'me', _, _, _, _, _, _])).toEqual([0, 1, 2]);
  });

  it('détecte une colonne', () => {
    // prettier-ignore
    expect(winningLine(['ai', _, _, 'ai', _, _, 'ai', _, _])).toEqual([0, 3, 6]);
  });

  it('détecte une diagonale', () => {
    // prettier-ignore
    expect(winningLine(['me', _, _, _, 'me', _, _, _, 'me'])).toEqual([0, 4, 8]);
  });

  it('rend null sans alignement', () => {
    // prettier-ignore
    expect(winningLine(['me', 'ai', 'me', _, _, _, _, _, _])).toBeNull();
    expect(winningLine(new Array<Mark | null>(9).fill(null))).toBeNull();
  });
});

describe('playAt — coup du joueur', () => {
  it('pose « me » sur la case visée', () => {
    const g = playAt(newMorpion(), 4);
    expect(g.board[4]).toBe('me');
  });

  it('gagne en complétant un alignement (« won »)', () => {
    // 'me' a déjà deux cases alignées, la troisième est libre.
    // prettier-ignore
    const g = game(['me', 'me', _, 'ai', 'ai', _, _, _, _]);
    const after = playAt(g, 2);
    expect(after.status).toBe('won');
    expect(winningLine(after.board)).toEqual([0, 1, 2]);
    // le joueur a gagné avant que l'IA ne joue : elle n'a rien posé
    expect(after.board.filter((c) => c === 'ai')).toHaveLength(2);
  });

  it('rend « draw » quand le dernier coup remplit le plateau sans alignement', () => {
    // une seule case libre (8) ; la remplir ne crée aucune ligne.
    // prettier-ignore
    const g = game(['me', 'ai', 'me', 'me', 'ai', 'ai', 'ai', 'me', _]);
    const after = playAt(g, 8);
    expect(after.board[8]).toBe('me');
    expect(after.status).toBe('draw');
    expect(winningLine(after.board)).toBeNull();
  });
});

describe('playAt — coups ignorés', () => {
  it('ignore une case déjà occupée', () => {
    const g = playAt(newMorpion(), 0);
    expect(playAt(g, 0)).toBe(g);
  });

  it('ignore un index hors grille', () => {
    const g = newMorpion();
    expect(playAt(g, -1)).toBe(g);
    expect(playAt(g, 9)).toBe(g);
  });

  it('ignore une partie déjà finie', () => {
    const won: Morpion = { board: new Array<Mark | null>(9).fill(null), status: 'won' };
    expect(playAt(won, 0)).toBe(won);
  });
});

describe('playAt — l’IA saisit un gain immédiat', () => {
  it('complète son alignement et fait perdre le joueur (« lost »)', () => {
    // 'ai' aligné sur 3 et 4, la case 5 ouvre le gain. Le coup du joueur en 0
    // ne gagne pas et ne remplit pas : l'IA doit donc jouer 5 et l'emporter.
    // prettier-ignore
    const g = game([_, _, _, 'ai', 'ai', _, _, _, _]);
    const after = playAt(g, 0);
    expect(after.status).toBe('lost');
    expect(after.board[5]).toBe('ai');
    expect(winningLine(after.board)).toEqual([3, 4, 5]);
  });
});

describe('playAt — l’IA est BATTABLE (ne bloque pas toujours)', () => {
  it('ignore une menace du joueur quand elle n’a pas de gain immédiat', () => {
    // Le joueur menace en 2 ([0,1,2]) ; l'IA n'a aucun gain immédiat. Une IA
    // parfaite bloquerait en 2 — celle-ci joue au hasard. On force le hasard
    // vers une autre case pour prouver qu'elle NE bloque PAS toujours.
    const spy = jest.spyOn(Math, 'random').mockReturnValue(0.2); // → cells[1], pas la case 2
    try {
      // prettier-ignore
      const g = game(['me', _, _, 'ai', _, _, _, _, _]);
      const after = playAt(g, 1); // menace 'me' en 0,1 → gagne en 2
      expect(after.status).toBe('playing'); // l'IA n'a ni gagné ni conclu
      expect(after.board[2]).toBeNull(); // la case bloquante reste LIBRE
      expect(after.board[4]).toBe('ai'); // l'IA a joué ailleurs
      // la menace est intacte : le joueur peut conclure et gagner
      const win = playAt(after, 2);
      expect(win.status).toBe('won');
      expect(winningLine(win.board)).toEqual([0, 1, 2]);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('playAt — pureté (aucune mutation de l’entrée)', () => {
  it('ne modifie ni le plateau ni le statut de la partie passée', () => {
    // prettier-ignore
    const input = game([_, _, _, 'ai', 'ai', _, _, _, _]);
    const boardRef = input.board;
    const snapshot = [...input.board];

    const after = playAt(input, 0); // l'IA va répliquer et gagner (branche « lost »)

    expect(after.status).toBe('lost');
    // l'entrée est laissée strictement intacte, même après le coup de l'IA
    expect(input.board).toBe(boardRef); // même référence de tableau
    expect(input.board).toEqual(snapshot); // même contenu (pas d'« ai » en 5)
    expect(input.status).toBe('playing');
    // la sortie est un nouvel objet, pas l'entrée recyclée
    expect(after).not.toBe(input);
    expect(after.board).not.toBe(input.board);
  });
});

describe('playAt — « draw » sur le coup de l’IA', () => {
  it('rend « draw » quand c’est l’IA qui remplit la dernière case sans aligner', () => {
    // Deux cases libres (7, 8). Le joueur joue 7 (ne gagne pas, ne remplit pas) ;
    // l'IA n'a aucun gain immédiat et remplit 8 → plateau plein sans alignement.
    // prettier-ignore
    const g = game(['me', 'ai', 'me', 'me', 'ai', 'ai', 'ai', _, _]);
    const after = playAt(g, 7);
    expect(after.board[7]).toBe('me');
    expect(after.board[8]).toBe('ai'); // seule case restante, jouée par l'IA
    expect(after.status).toBe('draw');
    expect(winningLine(after.board)).toBeNull();
  });
});
