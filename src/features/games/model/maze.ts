/**
 * Labyrinthe en grille — logique pure, sans UI ni aléa caché.
 *
 * Le joueur part en haut à gauche (case 0) et doit rejoindre l'arrivée en bas à
 * droite (case size*size-1) en se déplaçant d'une case dans une direction, à
 * condition qu'aucun mur ne barre le passage.
 *
 * Génération par « recursive backtracker » : on creuse un chemin en profondeur
 * en abattant les murs au fur et à mesure, en reculant dès qu'une case n'a plus
 * de voisin neuf. Chaque case est visitée exactement une fois → labyrinthe
 * « parfait » : un seul chemin entre deux cases, aucune case isolée, donc
 * TOUJOURS résoluble.
 *
 * Les cases sont indexées en row-major (ligne par ligne), de 0 à size*size-1.
 */

/** Murs d'une case : `true` = mur présent (infranchissable). */
export type Walls = { top: boolean; right: boolean; bottom: boolean; left: boolean };

export type Maze = {
  size: number;
  walls: Walls[];
  player: number;
  goal: number;
  status: 'playing' | 'won';
};

export const DEFAULT_SIZE = 6;

type Dir = 'up' | 'down' | 'left' | 'right';

const DIRS: Dir[] = ['up', 'down', 'left', 'right'];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Index de la case voisine dans `dir`, ou `null` si l'on sort de la grille. */
function neighbourOf(index: number, dir: Dir, size: number): number | null {
  const row = Math.floor(index / size);
  const col = index % size;
  switch (dir) {
    case 'up':
      return row > 0 ? index - size : null;
    case 'down':
      return row < size - 1 ? index + size : null;
    case 'left':
      return col > 0 ? index - 1 : null;
    case 'right':
      return col < size - 1 ? index + 1 : null;
  }
}

/** Y a-t-il un mur du côté `dir` de cette case ? */
function wallAt(w: Walls, dir: Dir): boolean {
  return dir === 'up' ? w.top : dir === 'down' ? w.bottom : dir === 'left' ? w.left : w.right;
}

/** Direction opposée — le mur d'un passage doit tomber des deux côtés. */
function opposite(dir: Dir): Dir {
  return dir === 'up' ? 'down' : dir === 'down' ? 'up' : dir === 'left' ? 'right' : 'left';
}

/** Abat (mute) le mur `dir` d'une case pendant la génération. */
function carve(w: Walls, dir: Dir): void {
  if (dir === 'up') w.top = false;
  else if (dir === 'down') w.bottom = false;
  else if (dir === 'left') w.left = false;
  else w.right = false;
}

/**
 * Nouvelle partie : grille pleine de murs, puis on creuse par backtracking.
 * Fraîche à chaque appel (l'ordre des directions est tiré au hasard).
 */
export function newMaze(size = DEFAULT_SIZE): Maze {
  const count = size * size;
  const walls: Walls[] = Array.from({ length: count }, () => ({
    top: true,
    right: true,
    bottom: true,
    left: true,
  }));

  const visited = new Array<boolean>(count).fill(false);
  const stack: number[] = [0];
  visited[0] = true;

  while (stack.length > 0) {
    const current = stack[stack.length - 1]!;
    // Premier voisin non visité, directions mélangées → chemin aléatoire.
    const step = shuffle(DIRS).flatMap((dir) => {
      const n = neighbourOf(current, dir, size);
      return n != null && !visited[n] ? [{ dir, n }] : [];
    })[0];

    if (!step) {
      stack.pop();
      continue;
    }
    carve(walls[current]!, step.dir);
    carve(walls[step.n]!, opposite(step.dir));
    visited[step.n] = true;
    stack.push(step.n);
  }

  return { size, walls, player: 0, goal: count - 1, status: 'playing' };
}

/**
 * Déplace le joueur d'une case dans `dir` si aucun mur ne barre le passage et
 * que la case reste dans la grille. Atteindre l'arrivée fait passer en 'won'.
 * Un coup illégal ou une partie finie renvoient la même partie (même référence).
 */
export function move(game: Maze, dir: 'up' | 'down' | 'left' | 'right'): Maze {
  if (game.status !== 'playing') return game;
  const here = game.walls[game.player];
  if (!here || wallAt(here, dir)) return game;
  const dest = neighbourOf(game.player, dir, game.size);
  if (dest == null) return game;
  return { ...game, player: dest, status: dest === game.goal ? 'won' : 'playing' };
}

/**
 * BFS depuis la case 0 jusqu'à l'arrivée en respectant les murs. Sert aux tests
 * à vérifier qu'un labyrinthe généré est bien résoluble.
 */
export function hasPath(maze: Maze): boolean {
  const start = 0;
  if (start === maze.goal) return true;
  const seen = new Array<boolean>(maze.walls.length).fill(false);
  const queue: number[] = [start];
  seen[start] = true;

  while (queue.length > 0) {
    const cell = queue.shift()!;
    const w = maze.walls[cell];
    if (!w) continue;
    for (const dir of DIRS) {
      if (wallAt(w, dir)) continue;
      const n = neighbourOf(cell, dir, maze.size);
      if (n == null || seen[n]) continue;
      if (n === maze.goal) return true;
      seen[n] = true;
      queue.push(n);
    }
  }
  return false;
}
