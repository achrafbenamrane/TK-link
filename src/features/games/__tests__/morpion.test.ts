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

describe('playAt — l’IA bloque une menace immédiate', () => {
  it('remplit la case bloquante quand le joueur menace un alignement', () => {
    // Le joueur pose 1 → « me » en 0,1 menace la ligne [0,1,2]. L'IA n'a aucun
    // gain immédiat : sa priorité est désormais de BLOQUER en 2, pas le hasard.
    // prettier-ignore
    const g = game(['me', _, _, 'ai', _, _, _, _, _]);
    const after = playAt(g, 1);
    expect(after.status).toBe('playing');
    expect(after.board[2]).toBe('ai'); // la menace est bel et bien bloquée
    expect(winningLine(after.board)).toBeNull();
  });
});

describe('playAt — l’IA préfère SON gain au blocage', () => {
  it('complète son propre alignement plutôt que de bloquer le joueur (« lost »)', () => {
    // L'IA aligne 3,4 (gagne en 5) ET le joueur menace [0,1,2] (gagne en 2).
    // Le joueur pose 8 (neutre) : l'IA doit choisir SON gain en 5, pas le
    // blocage en 2 — le gain immédiat prime sur le blocage.
    // prettier-ignore
    const g = game(['me', 'me', _, 'ai', 'ai', _, _, _, _]);
    const after = playAt(g, 8);
    expect(after.status).toBe('lost');
    expect(after.board[5]).toBe('ai'); // l'IA a bien conclu son alignement
    expect(after.board[2]).toBeNull(); // …sans bloquer la menace du joueur
    expect(winningLine(after.board)).toEqual([3, 4, 5]);
  });
});

describe('playAt — l’IA reste BATTABLE par une fourchette', () => {
  it('perd face à une double menace montée coup après coup (« won »)', () => {
    // On force le seul coup aléatoire de l'IA (choix d'un coin) pour piloter
    // toute la séquence. Le joueur monte une fourchette : deux menaces
    // simultanées que l'IA, qui ne bloque qu'une case, ne peut pas parer.
    const spy = jest.spyOn(Math, 'random').mockReturnValue(0.2); // coin le plus bas
    try {
      const g0 = newMorpion();
      const g1 = playAt(g0, 0); // « me » en 0 → l'IA prend le centre 4
      expect(g1.board[4]).toBe('ai');

      const g2 = playAt(g1, 8); // « me » en 0,8 (pas de menace) → l'IA prend le coin 2
      expect(g2.board[2]).toBe('ai');

      const g3 = playAt(g2, 6); // « me » en 0,6,8 → DOUBLE menace : 3 ([0,3,6]) et 7 ([6,7,8])
      expect(g3.status).toBe('playing');
      expect(g3.board[3]).toBe('ai'); // l'IA n'a pu bloquer qu'une menace (3)…
      expect(g3.board[7]).toBeNull(); // …l'autre (7) reste ouverte

      const g4 = playAt(g3, 7); // le joueur conclut la seconde menace
      expect(g4.status).toBe('won');
      expect(winningLine(g4.board)).toEqual([6, 7, 8]);
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
