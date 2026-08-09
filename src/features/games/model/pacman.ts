/**
 * PacTK — moteur pur du jeu façon Pac-Man, sans UI ni aléa caché.
 *
 * Déplacement par CASES sur une grille (un pas par `tick`). On mange chaque
 * case traversée ; tout manger → gagné (coupon). Les fantômes coûtent une vie ;
 * à 0 vie, perdu. Le labyrinthe est tressé (des boucles, pas un arbre) et
 * régénéré à chaque partie — rien à mémoriser.
 *
 * La logique est ici ; les visuels (photos des offres, dessin du perso) sont
 * dans l'UI. Le sens de déplacement voulu (`desired`) vient du joystick.
 */

export type Walls = { t: boolean; r: boolean; b: boolean; l: boolean };
export type Dir = { dx: number; dy: number };
export type Ghost = { c: number; r: number; dx: number; dy: number };
export type Pac = { c: number; r: number; dx: number; dy: number };

export type PacGame = {
  cols: number;
  rows: number;
  walls: Walls[];
  pac: Pac;
  ghosts: Ghost[];
  /** Cases déjà mangées (index à plat). */
  eaten: boolean[];
  /** Cases portant un visuel « food » bonus (index à plat). */
  food: number[];
  dotsLeft: number;
  lives: number;
  frame: number;
  status: 'playing' | 'won' | 'lost';
};

export const DEFAULT_COLS = 9;
export const DEFAULT_ROWS = 11;
export const LIVES = 3;
export const GHOSTS = 3;

const DIRS: Dir[] = [
  { dx: 0, dy: -1 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
];

const rnd = (n: number): number => Math.floor(Math.random() * n);
const at = (cols: number, c: number, r: number): number => r * cols + c;

/** Peut-on quitter la case (c,r) dans la direction (dx,dy) ? (mur absent) */
export function openDir(
  walls: Walls[],
  cols: number,
  c: number,
  r: number,
  dx: number,
  dy: number,
): boolean {
  const w = walls[at(cols, c, r)];
  if (!w) return false;
  if (dy < 0) return !w.t;
  if (dx > 0) return !w.r;
  if (dy > 0) return !w.b;
  if (dx < 0) return !w.l;
  return false;
}

/** Labyrinthe tressé (recursive backtracker + ouverture de boucles). */
function genMaze(cols: number, rows: number): Walls[] {
  const walls: Walls[] = Array.from({ length: cols * rows }, () => ({
    t: true,
    r: true,
    b: true,
    l: true,
  }));
  const seen = new Set([0]);
  const stack = [0];
  const nb = (i: number): [number, keyof Walls, keyof Walls][] => {
    const c = i % cols;
    const r = (i / cols) | 0;
    const o: [number, keyof Walls, keyof Walls][] = [];
    if (r > 0) o.push([i - cols, 't', 'b']);
    if (c < cols - 1) o.push([i + 1, 'r', 'l']);
    if (r < rows - 1) o.push([i + cols, 'b', 't']);
    if (c > 0) o.push([i - 1, 'l', 'r']);
    return o;
  };
  while (stack.length) {
    const cur = stack[stack.length - 1]!;
    const opt = nb(cur).filter(([n]) => !seen.has(n));
    if (!opt.length) {
      stack.pop();
      continue;
    }
    const [n, d1, d2] = opt[rnd(opt.length)]!;
    walls[cur]![d1] = false;
    walls[n]![d2] = false;
    seen.add(n);
    stack.push(n);
  }
  // Tressage : on ouvre des murs en trop → des boucles (couloirs façon Pac-Man).
  for (let i = 0; i < cols * rows; i++) {
    const w = walls[i]!;
    const wc = (w.t ? 1 : 0) + (w.r ? 1 : 0) + (w.b ? 1 : 0) + (w.l ? 1 : 0);
    if (wc >= 3 && Math.random() < 0.6) {
      const closed = nb(i).filter(([, d1]) => w[d1]);
      if (closed.length) {
        const [n, d1, d2] = closed[rnd(closed.length)]!;
        walls[i]![d1] = false;
        walls[n]![d2] = false;
      }
    }
  }
  return walls;
}

const startCorners = (cols: number, rows: number): [number, number][] => [
  [0, 0],
  [cols - 1, 0],
  [cols - 1, rows - 1],
];

export function newPacGame(cols = DEFAULT_COLS, rows = DEFAULT_ROWS, foodCount = 6): PacGame {
  const walls = genMaze(cols, rows);
  const pac: Pac = { c: cols >> 1, r: rows >> 1, dx: 0, dy: 0 };
  const eaten = Array<boolean>(cols * rows).fill(false);
  eaten[at(cols, pac.c, pac.r)] = true;

  const free = [...Array(cols * rows).keys()].filter((i) => i !== at(cols, pac.c, pac.r));
  const food: number[] = [];
  for (let k = 0; k < foodCount && free.length; k++) {
    food.push(free.splice(rnd(free.length), 1)[0]!);
  }
  const ghosts: Ghost[] = startCorners(cols, rows)
    .slice(0, GHOSTS)
    .map(([c, r]) => ({ c, r, dx: 0, dy: 1 }));

  return {
    cols,
    rows,
    walls,
    pac,
    ghosts,
    eaten,
    food,
    dotsLeft: cols * rows - 1,
    lives: LIVES,
    frame: 0,
    status: 'playing',
  };
}

/** Un fantôme avance d'une case (au hasard, sans faire demi-tour sauf impasse). */
function moveGhost(walls: Walls[], cols: number, g: Ghost): Ghost {
  const forward = DIRS.filter(
    (d) => openDir(walls, cols, g.c, g.r, d.dx, d.dy) && !(d.dx === -g.dx && d.dy === -g.dy),
  );
  const list = forward.length
    ? forward
    : DIRS.filter((d) => openDir(walls, cols, g.c, g.r, d.dx, d.dy));
  if (!list.length) return g;
  const d = list[rnd(list.length)]!;
  return { c: g.c + d.dx, r: g.r + d.dy, dx: d.dx, dy: d.dy };
}

/**
 * Un pas de jeu. `desired` = direction voulue (joystick). Le perso tourne si
 * c'est ouvert, sinon continue tout droit, sinon s'arrête. Les fantômes vont à
 * MI-VITESSE (une case sur deux) — la partie reste gagnable. Fonction PURE.
 */
export function tick(game: PacGame, desired: Dir): PacGame {
  if (game.status !== 'playing') return game;
  const { walls, cols, rows } = game;

  let { c, r, dx, dy } = game.pac;
  const pc = c;
  const pr = r;
  if ((desired.dx || desired.dy) && openDir(walls, cols, c, r, desired.dx, desired.dy)) {
    dx = desired.dx;
    dy = desired.dy;
  }
  if ((dx || dy) && openDir(walls, cols, c, r, dx, dy)) {
    c += dx;
    r += dy;
  }
  const pac: Pac = { c, r, dx, dy };

  let eaten = game.eaten;
  let dotsLeft = game.dotsLeft;
  const i = at(cols, c, r);
  if (!eaten[i]) {
    eaten = eaten.slice();
    eaten[i] = true;
    dotsLeft--;
  }

  const prevG = game.ghosts.map((g) => ({ c: g.c, r: g.r }));
  const moveGhosts = game.frame % 2 === 1; // mi-vitesse ; frame 0 = repos
  let ghosts = moveGhosts ? game.ghosts.map((g) => moveGhost(walls, cols, g)) : game.ghosts;

  let lives = game.lives;
  let status: PacGame['status'] = 'playing';
  const caught = ghosts.some(
    (g, k) =>
      (g.c === pac.c && g.r === pac.r) ||
      (g.c === pc && g.r === pr && prevG[k]!.c === pac.c && prevG[k]!.r === pac.r),
  );
  if (caught) {
    lives--;
    if (lives <= 0) {
      status = 'lost';
    } else {
      pac.c = cols >> 1;
      pac.r = rows >> 1;
      pac.dx = 0;
      pac.dy = 0;
      const corners = startCorners(cols, rows);
      ghosts = ghosts.map((_, k) => ({ c: corners[k]![0], r: corners[k]![1], dx: 0, dy: 1 }));
    }
  }
  if (status === 'playing' && dotsLeft <= 0) status = 'won';

  return { ...game, pac, ghosts, eaten, dotsLeft, lives, frame: game.frame + 1, status };
}

/** BFS depuis le départ : toutes les cases sont-elles atteignables ? (tests) */
export function allReachable(game: PacGame): boolean {
  const { walls, cols, rows } = game;
  const seen = new Set<number>();
  const start = at(cols, cols >> 1, rows >> 1);
  const q = [start];
  seen.add(start);
  while (q.length) {
    const i = q.shift()!;
    const c = i % cols;
    const r = (i / cols) | 0;
    for (const d of DIRS) {
      if (openDir(walls, cols, c, r, d.dx, d.dy)) {
        const n = at(cols, c + d.dx, r + d.dy);
        if (!seen.has(n)) {
          seen.add(n);
          q.push(n);
        }
      }
    }
  }
  return seen.size === cols * rows;
}
