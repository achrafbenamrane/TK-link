import { hasPath, move, newMaze, type Maze, type Walls } from '../model/maze';

function walled(): Walls {
  return { top: true, right: true, bottom: true, left: true };
}

/**
 * Labyrinthe déterministe 2×2 (on ne dépend pas de la génération aléatoire).
 *   0 — 1        passages ouverts : 0↔1 (droite), 1↔3 (bas).
 *       |        arrivée = case 3.
 *   2   3
 */
function fixedMaze(): Maze {
  const walls: Walls[] = [walled(), walled(), walled(), walled()];
  // 0 ↔ 1
  walls[0]!.right = false;
  walls[1]!.left = false;
  // 1 ↔ 3
  walls[1]!.bottom = false;
  walls[3]!.top = false;
  return { size: 2, walls, player: 0, goal: 3, status: 'playing' };
}

/**
 * Compte les ouvertures internes = paires de cases voisines SANS mur entre
 * elles. On ne regarde que le mur droit et le mur bas de chaque case pour ne
 * compter chaque passage qu'une seule fois. Un labyrinthe « parfait » (arbre
 * couvrant) en a exactement size*size-1 ; au-delà, il y a des cycles.
 */
function countOpenings(m: Maze): number {
  const { size, walls } = m;
  let openings = 0;
  for (let i = 0; i < walls.length; i++) {
    const w = walls[i]!;
    const col = i % size;
    const row = Math.floor(i / size);
    if (col < size - 1 && !w.right) openings++;
    if (row < size - 1 && !w.bottom) openings++;
  }
  return openings;
}

describe('newMaze', () => {
  it('crée size*size cases et reste toujours résoluble', () => {
    for (let i = 0; i < 20; i++) {
      const m = newMaze();
      expect(m.walls).toHaveLength(11 * 11);
      expect(m.player).toBe(0);
      expect(m.goal).toBe(120);
      expect(m.status).toBe('playing');
      expect(hasPath(m)).toBe(true);
    }
  });

  it('est tressé : plus d’ouvertures qu’un arbre couvrant (donc des boucles)', () => {
    // Un labyrinthe parfait a exactement size*size-1 ouvertures internes. Le
    // tressage en ajoute → strictement plus, de façon fiable à chaque tirage.
    for (let i = 0; i < 30; i++) {
      const m = newMaze();
      const perfectTreeOpenings = m.size * m.size - 1;
      expect(countOpenings(m)).toBeGreaterThan(perfectTreeOpenings);
      expect(hasPath(m)).toBe(true);
    }
  });

  it('respecte une taille personnalisée et reste résoluble', () => {
    const m = newMaze(4);
    expect(m.size).toBe(4);
    expect(m.walls).toHaveLength(16);
    expect(m.goal).toBe(15);
    expect(hasPath(m)).toBe(true);
  });

  it('a des murs cohérents entre voisins (pas de passage à sens unique)', () => {
    const m = newMaze(5);
    const { size, walls } = m;
    for (let i = 0; i < walls.length; i++) {
      const w = walls[i]!;
      const col = i % size;
      const row = Math.floor(i / size);
      // Un mur ouvert d'un côté l'est aussi du côté du voisin (et inversement).
      if (col < size - 1) expect(w.right).toBe(walls[i + 1]!.left);
      if (row < size - 1) expect(w.bottom).toBe(walls[i + size]!.top);
    }
  });
});

describe('move', () => {
  it('est bloqué par un mur (le joueur ne bouge pas)', () => {
    const g = fixedMaze();
    const after = move(g, 'down'); // walls[0].bottom fermé
    expect(after.player).toBe(0);
    expect(after).toBe(g); // partie inchangée
  });

  it('traverse un passage ouvert et met à jour le joueur', () => {
    const g = fixedMaze();
    const after = move(g, 'right'); // 0 → 1
    expect(after.player).toBe(1);
    expect(after.status).toBe('playing');
  });

  it('atteindre l’arrivée fait passer en « won »', () => {
    let g = fixedMaze();
    g = move(g, 'right'); // 0 → 1
    g = move(g, 'down'); // 1 → 3 (arrivée)
    expect(g.player).toBe(3);
    expect(g.status).toBe('won');
  });

  it('ne mute pas la partie d’origine (fonction pure)', () => {
    const g = fixedMaze();
    const before = { player: g.player, status: g.status };
    const after = move(g, 'right'); // 0 → 1
    expect(after.player).toBe(1);
    // l’objet d’entrée est intact et distinct du résultat
    expect(g.player).toBe(before.player);
    expect(g.status).toBe(before.status);
    expect(after).not.toBe(g);
  });

  it('ignore un coup hors grille et une partie finie', () => {
    const g = fixedMaze();
    expect(move(g, 'up')).toBe(g); // bord supérieur
    expect(move(g, 'left')).toBe(g); // bord gauche

    const won = move(move(g, 'right'), 'down');
    expect(won.status).toBe('won');
    expect(move(won, 'right')).toBe(won); // plus aucun coup après victoire
  });
});

/**
 * Oracle de résolubilité : ces tests prouvent que `hasPath` sait aussi répondre
 * « false ». Sans eux, le « toujours résoluble » de newMaze passerait même si
 * hasPath renvoyait toujours true (garantie creuse).
 */
describe('hasPath', () => {
  it('renvoie true quand l’arrivée est la case de départ', () => {
    const walls: Walls[] = [walled()];
    const trivial: Maze = { size: 1, walls, player: 0, goal: 0, status: 'playing' };
    expect(hasPath(trivial)).toBe(true);
  });

  it('renvoie false quand tout est muré (arrivée injoignable)', () => {
    // Grille 2×2 entièrement fermée : aucune case n’en rejoint une autre.
    const walls: Walls[] = [walled(), walled(), walled(), walled()];
    const sealed: Maze = { size: 2, walls, player: 0, goal: 3, status: 'playing' };
    expect(hasPath(sealed)).toBe(false);
  });

  it('renvoie false quand l’arrivée est dans une autre composante', () => {
    // 0 ↔ 1 ouverts, mais la case 3 (arrivée) reste isolée du reste.
    const walls: Walls[] = [walled(), walled(), walled(), walled()];
    walls[0]!.right = false;
    walls[1]!.left = false;
    const split: Maze = { size: 2, walls, player: 0, goal: 3, status: 'playing' };
    expect(hasPath(split)).toBe(false);
  });
});
