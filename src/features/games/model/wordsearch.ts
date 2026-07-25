/**
 * Mots mêlés (« word search ») — logique pure, sans UI ni aléa caché.
 *
 * Le principe : on cache une liste de mots dans une grille carrée, placés à
 * l'horizontale ou à la verticale (dans un sens ou dans l'autre), puis on
 * comble le reste avec des lettres A-Z tirées au hasard. Le joueur sélectionne
 * une ligne droite (d'une case de départ à une case d'arrivée) ; si elle couvre
 * exactement un mot, il est trouvé.
 *
 * Comme les autres jeux, le contenu n'est PAS codé ici : les mots arrivent en
 * paramètre. Ils sont normalisés (majuscules, sans accents ni espaces) — un mot
 * ajouté par un commerçant devient donc automatiquement une cible, sans rien
 * toucher au moteur.
 *
 * Représentation : `grid` est un tableau plat de lettres (une par case), indexé
 * en « row-major » — la case (r, c) est à l'indice r * size + c. Les `cells`
 * d'un mot sont ces indices, dans l'ordre de lecture du mot.
 */

export type Placed = { word: string; cells: number[] };

export type WordSearch = {
  size: number;
  /** Lettres, une par case, à plat (longueur = size * size). */
  grid: string[];
  placed: Placed[];
  /** Mots déjà trouvés (leur forme normalisée). */
  found: string[];
  status: 'playing' | 'won';
};

export const DEFAULT_MIN_SIZE = 8;

/** Case en cours de remplissage : une lettre posée, ou `null` si encore vide. */
type Cell = string | null;

/** Majuscules A-Z uniquement : on décompose les accents puis on jette tout le reste (espaces compris). */
function normalize(word: string): string {
  return word
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // marques diacritiques combinantes
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
}

function randomLetter(): string {
  return String.fromCharCode(65 + Math.floor(Math.random() * 26));
}

function sameCells(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** « won » seulement s'il y a des mots placés et qu'ils sont tous trouvés. */
function computeStatus(foundCount: number, placedCount: number): 'playing' | 'won' {
  return placedCount > 0 && foundCount === placedCount ? 'won' : 'playing';
}

/**
 * Tente de poser un mot dans la grille : orientation (H/V) et sens tirés au
 * hasard, sur plusieurs essais. Un placement est valide si chaque case visée
 * est vide OU porte déjà la même lettre (les croisements sont permis). Renvoie
 * les indices dans l'ordre de lecture du mot, ou `null` si aucun essai n'a
 * abouti.
 */
function placeWord(cells: Cell[], size: number, word: string): number[] | null {
  const len = word.length;
  if (len === 0 || len > size) return null;

  const ATTEMPTS = 80;
  for (let t = 0; t < ATTEMPTS; t++) {
    const horizontal = Math.random() < 0.5;
    const backward = Math.random() < 0.5;
    const maxStart = size - len; // dernière position de départ où le mot tient
    const line = Math.floor(Math.random() * size); // ligne (H) ou colonne (V)
    const start = Math.floor(Math.random() * (maxStart + 1));

    const target: number[] = [];
    for (let k = 0; k < len; k++) {
      // sens arrière : on écrit le mot de la fin vers le début
      const offset = backward ? start + len - 1 - k : start + k;
      target.push(horizontal ? line * size + offset : offset * size + line);
    }

    let ok = true;
    for (let k = 0; k < len; k++) {
      const existing = cells[target[k]!];
      if (existing != null && existing !== word[k]!) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;

    for (let k = 0; k < len; k++) cells[target[k]!] = word[k]!;
    return target;
  }
  return null;
}

/**
 * Nouvelle grille. Les mots sont normalisés puis dédupliqués ; la taille par
 * défaut vaut max(longueur du plus long mot, 8). On ne garde que les mots qui
 * tiennent (longueur ≤ taille) ET que le placement a réussi à poser. Le reste
 * de la grille est comblé de lettres aléatoires.
 */
export function newWordSearch(words: string[], size?: number): WordSearch {
  const normalized = [...new Set(words.map(normalize).filter((w) => w.length > 0))];
  const longest = normalized.reduce((m, w) => Math.max(m, w.length), 0);
  const gridSize = size ?? Math.max(longest, DEFAULT_MIN_SIZE);

  const cells: Cell[] = new Array<Cell>(gridSize * gridSize).fill(null);
  const placed: Placed[] = [];
  for (const w of normalized) {
    if (w.length > gridSize) continue; // ne tient pas : écarté
    const at = placeWord(cells, gridSize, w);
    if (at) placed.push({ word: w, cells: at });
  }

  const grid = cells.map((c) => c ?? randomLetter());
  return {
    size: gridSize,
    grid,
    placed,
    found: [],
    status: computeStatus(0, placed.length),
  };
}

/**
 * Indices « row-major » de `from` à `to` si les deux cases sont sur la MÊME
 * ligne ou la MÊME colonne (parcours contigu, dans l'ordre from → to). Sinon,
 * ou hors bornes, renvoie `null`. Une case seule (from === to) renvoie `[from]`.
 */
export function straightLine(size: number, from: number, to: number): number[] | null {
  const total = size * size;
  if (from < 0 || from >= total || to < 0 || to >= total) return null;

  const fr = Math.floor(from / size);
  const fc = from % size;
  const tr = Math.floor(to / size);
  const tc = to % size;

  if (fr === tr) {
    const step = tc >= fc ? 1 : -1;
    const out: number[] = [];
    for (let c = fc; ; c += step) {
      out.push(fr * size + c);
      if (c === tc) break;
    }
    return out;
  }
  if (fc === tc) {
    const step = tr >= fr ? 1 : -1;
    const out: number[] = [];
    for (let r = fr; ; r += step) {
      out.push(r * size + fc);
      if (r === tr) break;
    }
    return out;
  }
  return null;
}

/**
 * Sélection d'une ligne droite. Si elle correspond aux cellules d'un mot placé
 * (dans un sens ou dans l'autre) encore non trouvé, ce mot passe en « trouvé ».
 * La partie est gagnée dès que tous les mots placés le sont. Toute sélection
 * hors ligne, non concordante ou répétée renvoie la partie inchangée.
 */
export function selectLine(game: WordSearch, from: number, to: number): WordSearch {
  const line = straightLine(game.size, from, to);
  if (!line) return game;

  const reversed = [...line].reverse();
  const match = game.placed.find(
    (p) =>
      !game.found.includes(p.word) && (sameCells(line, p.cells) || sameCells(reversed, p.cells)),
  );
  if (!match) return game;

  const found = [...game.found, match.word];
  return { ...game, found, status: computeStatus(found.length, game.placed.length) };
}
