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
  /** Fond de la tuile : ink (true) ou vert de marque (false). */
  dark: boolean;
};

export const GAME_TILES: GameTile[] = [
  {
    key: 'memory',
    name: 'Trouvez les paires',
    tagline: 'Retrouvez les duos',
    icon: 'grid',
    dark: false,
  },
  { key: 'morpion', name: 'Morpion', tagline: 'Alignez trois plats', icon: 'hash', dark: true },
  { key: 'maze', name: 'Labyrinthe', tagline: 'Trouvez le chemin', icon: 'navigation', dark: true },
  {
    key: 'wordsearch',
    name: 'Mots mêlés',
    tagline: 'Cachés dans la grille',
    icon: 'type',
    dark: false,
  },
  {
    key: 'quiz',
    name: 'Le juste prix',
    tagline: 'Devinez le prix flash',
    icon: 'zap',
    dark: false,
  },
  { key: 'pacman', name: 'PacTK', tagline: 'Croquez tout au joystick', icon: 'disc', dark: true },
];

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
