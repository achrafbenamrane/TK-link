import { GAME_TILES, tileIsDark } from '../model/tiles';

describe('l’alternance des tuiles de jeu', () => {
  it('donne noir, vert, noir, vert… sur une seule ligne', () => {
    // La demande du client, mot pour mot : « black green black green ».
    const row = GAME_TILES.map((_, i) => (tileIsDark(i) ? 'noir' : 'vert'));
    expect(row).toEqual(['noir', 'vert', 'noir', 'vert', 'noir', 'vert']);
  });

  it('donne un damier sur deux colonnes, et non deux colonnes unies', () => {
    // Alterner sur le seul index produirait une colonne toute noire et une
    // colonne toute verte — l’inverse de l’effet recherché.
    const grid = GAME_TILES.map((_, i) => (tileIsDark(i, 2) ? 'noir' : 'vert'));
    expect(grid).toEqual(['noir', 'vert', 'vert', 'noir', 'noir', 'vert']);
  });

  it('ne laisse jamais deux voisins de la même couleur sur une ligne', () => {
    // Le vrai défaut corrigé ici : la couleur vivait dans la donnée, et un
    // réagencement collait deux tuiles identiques côte à côte sans que rien
    // ne le signale.
    for (let i = 1; i < GAME_TILES.length; i++) {
      expect(tileIsDark(i)).not.toBe(tileIsDark(i - 1));
    }
  });

  it('ne fait plus porter la couleur par le jeu lui-même', () => {
    // Si un `dark` réapparaît dans la donnée, les deux sources divergeront.
    for (const tile of GAME_TILES) expect(tile).not.toHaveProperty('dark');
  });
});
