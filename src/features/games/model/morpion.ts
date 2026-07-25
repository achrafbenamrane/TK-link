/**
 * Morpion (tic-tac-toe) 3×3 — logique pure, sans UI ni aléa caché.
 *
 * Le joueur est « me », l'application est « ai ». Aligner trois cases → coupon.
 * L'IA est plus maligne qu'un simple hasard, mais reste BATTABLE : elle ne
 * calcule pas de minimax et ne se construit jamais de double menace
 * (fourchette). Ordre de priorité de son coup :
 *  1. jouer un gain immédiat s'il existe ;
 *  2. sinon bloquer un gain immédiat du joueur ;
 *  3. sinon prendre le centre (case 4) s'il est libre ;
 *  4. sinon un coin libre au hasard ;
 *  5. sinon n'importe quelle case libre au hasard.
 * Un joueur habile qui monte une fourchette (deux menaces simultanées) peut
 * donc toujours l'emporter : l'IA ne pourra en bloquer qu'une.
 *
 * Le plateau est un tableau plat de 9 cases (indices 0..8, en lignes) :
 *     0 | 1 | 2
 *     3 | 4 | 5
 *     6 | 7 | 8
 */

export type Mark = 'me' | 'ai';

export type Morpion = {
  board: (Mark | null)[];
  status: 'playing' | 'won' | 'lost' | 'draw';
};

/** Côté de la grille : 3×3 ⇒ board.length === 9. */
export const SIZE = 3;

/** Les quatre coins, préférés au reste quand le centre est déjà pris. */
const CORNERS: readonly number[] = [0, 2, 6, 8];

/** Les 8 alignements possibles (3 lignes, 3 colonnes, 2 diagonales). */
const LINES: readonly [number, number, number][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

/** Nouvelle partie : plateau vide, à jouer. */
export function newMorpion(): Morpion {
  return { board: new Array<Mark | null>(SIZE * SIZE).fill(null), status: 'playing' };
}

/**
 * Le premier alignement complet trouvé (mêmes marques), ou `null`. Sert autant
 * à détecter une victoire qu'à surligner la ligne à l'écran ; marche pour l'une
 * ou l'autre marque, sans distinction.
 */
export function winningLine(board: (Mark | null)[]): number[] | null {
  for (const [a, b, c] of LINES) {
    const m = board[a];
    // `m != null` écarte à la fois le vide et l'`undefined` d'un index hors borne.
    if (m != null && board[b] === m && board[c] === m) return [a, b, c];
  }
  return null;
}

/** Indices des cases encore libres. */
function emptyCells(board: (Mark | null)[]): number[] {
  const cells: number[] = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i] == null) cells.push(i);
  }
  return cells;
}

function isFull(board: (Mark | null)[]): boolean {
  return board.every((c) => c != null);
}

/** Case qui complète un alignement pour `mark`, ou `null` s'il n'y en a pas. */
function findWinningMove(board: (Mark | null)[], mark: Mark): number | null {
  for (const i of emptyCells(board)) {
    const next = [...board];
    next[i] = mark;
    if (winningLine(next) != null) return i;
  }
  return null;
}

/**
 * Coup de l'IA, par ordre de priorité : gain immédiat → blocage d'un gain du
 * joueur → centre → coin libre au hasard → case libre au hasard. `null` s'il ne
 * reste plus rien à jouer. Volontairement sans minimax ni fourchette, pour
 * rester battable par un joueur qui monte une double menace.
 */
function aiMove(board: (Mark | null)[]): number | null {
  // 1) saisir un gain immédiat.
  const win = findWinningMove(board, 'ai');
  if (win != null) return win;

  // 2) sinon bloquer le gain immédiat du joueur (une seule menace à la fois).
  const block = findWinningMove(board, 'me');
  if (block != null) return block;

  // 3) sinon prendre le centre s'il est libre.
  if (board[4] == null) return 4;

  // 4) sinon un coin libre au hasard.
  const freeCorners = CORNERS.filter((i) => board[i] == null);
  if (freeCorners.length > 0) {
    const pick = freeCorners[Math.floor(Math.random() * freeCorners.length)];
    if (pick != null) return pick;
  }

  // 5) sinon n'importe quelle case libre au hasard.
  const cells = emptyCells(board);
  if (cells.length === 0) return null;
  const pick = cells[Math.floor(Math.random() * cells.length)];
  return pick ?? null;
}

/**
 * Le joueur pose « me » sur `index`, puis l'IA réplique. Ignore le coup si la
 * partie est finie, si l'index est hors grille, ou si la case est déjà prise.
 *
 * Enchaînement :
 *  • après le coup du joueur : alignement ⇒ « won » ; sinon plateau plein ⇒ « draw » ;
 *  • sinon l'IA joue (gain, blocage, centre, coin, hasard) : alignement ⇒ « lost » ;
 *    plateau plein ⇒ « draw » ; sinon on continue à jouer.
 */
export function playAt(game: Morpion, index: number): Morpion {
  if (game.status !== 'playing') return game;
  if (index < 0 || index >= game.board.length) return game;
  if (game.board[index] != null) return game;

  const board = [...game.board];
  board[index] = 'me';

  if (winningLine(board) != null) return { board, status: 'won' };
  if (isFull(board)) return { board, status: 'draw' };

  const move = aiMove(board);
  if (move != null) board[move] = 'ai';

  // Seule l'IA vient de jouer : un éventuel alignement est forcément le sien.
  if (winningLine(board) != null) return { board, status: 'lost' };
  if (isFull(board)) return { board, status: 'draw' };

  return { board, status: 'playing' };
}
