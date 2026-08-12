/**
 * Le catalogue des mini-jeux — UNE seule table pour tous les points d'entrée.
 *
 * Le menu « Jeux » et le rail du hub affichent les mêmes jeux ; sans cette
 * table partagée, ajouter un jeu obligerait à le déclarer deux fois, et les
 * deux listes divergeraient au premier oubli.
 */

export type GameKey = 'memory' | 'quiz' | 'morpion' | 'maze' | 'wordsearch' | 'pacman';

export type GameTile = {
  key: GameKey;
  name: string;
  tagline: string;
  /** Nom d'icône Feather — l'UI le résout, la donnée reste sans dépendance. */
  icon: 'grid' | 'zap' | 'hash' | 'navigation' | 'type' | 'disc';
};

export const GAME_TILES: GameTile[] = [
  { key: 'memory', name: 'Trouvez les paires', tagline: 'Retrouvez les duos', icon: 'grid' },
  { key: 'morpion', name: 'Morpion', tagline: 'Alignez trois plats', icon: 'hash' },
  { key: 'maze', name: 'Labyrinthe', tagline: 'Trouvez le chemin', icon: 'navigation' },
  { key: 'wordsearch', name: 'Mots mêlés', tagline: 'Cachés dans la grille', icon: 'type' },
  { key: 'quiz', name: 'Le juste prix', tagline: 'Devinez le prix flash', icon: 'zap' },
  { key: 'pacman', name: 'PacTK', tagline: 'Croquez tout au joystick', icon: 'disc' },
];

/**
 * Le fond d'une tuile : noir, vert, noir, vert…
 *
 * L'alternance dépend de la POSITION, jamais du jeu. Portée par la donnée
 * (un drapeau `dark` sur chaque tuile), elle se dérèglait au premier
 * réagencement : la liste affichait noir-noir au milieu et vert-vert plus
 * loin, parce que personne ne recompte six drapeaux à la main après avoir
 * déplacé une ligne.
 *
 * `columns` compte parce que le damier n'est pas le même à une ou deux
 * colonnes. Dans une grille à deux colonnes, alterner sur le seul index
 * donnerait deux colonnes unies — une noire, une verte — et pas un damier.
 * On alterne donc sur `ligne + colonne`, ce qui redonne exactement
 * « noir, vert, noir » sur une seule colonne.
 */
export function tileIsDark(index: number, columns = 1): boolean {
  const row = Math.floor(index / columns);
  const col = index % columns;
  return (row + col) % 2 === 0;
}

/**
 * Quels jeux sont jouables avec les réservoirs disponibles.
 *
 * Un jeu sans matière (pas assez d'images, pas assez d'offres pour le quiz)
 * s'ouvrirait sur une grille vide : on le verrouille plutôt que de laisser
 * l'utilisateur découvrir le vide.
 */
export function playableGames(pools: {
  images: number;
  quiz: number;
  words: number;
}): Record<GameKey, boolean> {
  return {
    memory: pools.images >= 3,
    morpion: pools.images >= 2,
    maze: pools.images >= 1,
    wordsearch: pools.words >= 3,
    quiz: pools.quiz >= 3,
    pacman: pools.images >= 1,
  };
}
