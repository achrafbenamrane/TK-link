/**
 * Jeu de mémoire (« switch card ») — logique pure, sans UI ni aléa caché.
 *
 * Règles, telles que demandées :
 *  • trouver 3 paires d'images (3 « emplacements ») ;
 *  • 3 erreurs autorisées ; à la 3ᵉ, la partie est perdue ;
 *  • à la perte, on rejoue avec des images FRAÎCHES (newGame retire au hasard).
 *
 * Les images ne sont PAS codées ici : elles arrivent en paramètre (`pool`),
 * alimenté par le catalogue des offres. Une offre ajoutée par un commerçant
 * devient donc automatiquement une carte, sans rien toucher au jeu.
 */

export type CardImage = { id: string; source: number };

export type Card = {
  /** Unique par carte (deux cartes partagent le même `imageId`). */
  id: string;
  imageId: string;
  source: number;
};

export type MemoryGame = {
  cards: Card[];
  /** imageId des paires trouvées. */
  matched: string[];
  /** id des cartes actuellement retournées (0, 1 ou 2 le temps d'un tour). */
  flipped: string[];
  mistakes: number;
  maxMistakes: number;
  pairs: number;
  status: 'playing' | 'won' | 'lost';
};

export const DEFAULT_PAIRS = 3;
export const DEFAULT_MAX_MISTAKES = 3;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * Nouvelle partie : `pairs` images tirées au hasard du pool, dupliquées, puis
 * mélangées. Retire un sous-ensemble frais à chaque appel — d'où la variété
 * demandée entre deux parties.
 */
export function newGame(
  pool: CardImage[],
  pairs = DEFAULT_PAIRS,
  maxMistakes = DEFAULT_MAX_MISTAKES,
): MemoryGame {
  const chosen = shuffle(pool).slice(0, Math.min(pairs, pool.length));
  const cards: Card[] = shuffle(
    chosen.flatMap((img) => [
      { id: `${img.id}-a`, imageId: img.id, source: img.source },
      { id: `${img.id}-b`, imageId: img.id, source: img.source },
    ]),
  );
  return {
    cards,
    matched: [],
    flipped: [],
    mistakes: 0,
    maxMistakes,
    pairs: chosen.length,
    status: 'playing',
  };
}

/** Une carte est-elle face visible (paire trouvée, ou retournée ce tour) ? */
export function isRevealed(game: MemoryGame, card: Card): boolean {
  return game.matched.includes(card.imageId) || game.flipped.includes(card.id);
}

/** Le dernier tour à deux cartes s'est-il soldé par une erreur en attente ? */
export function isMismatchPending(game: MemoryGame): boolean {
  if (game.flipped.length !== 2) return false;
  const [a, b] = game.flipped.map((id) => game.cards.find((c) => c.id === id));
  return !!a && !!b && a.imageId !== b.imageId;
}

/**
 * Retourne une carte. Ignore l'action si le coup est impossible (jeu fini,
 * carte déjà trouvée ou déjà retournée, deux cartes en attente de résolution).
 * À la deuxième carte, la paire est évaluée immédiatement.
 */
export function flipCard(game: MemoryGame, cardId: string): MemoryGame {
  if (game.status !== 'playing') return game;
  if (game.flipped.length >= 2) return game;

  const card = game.cards.find((c) => c.id === cardId);
  if (!card) return game;
  if (game.matched.includes(card.imageId)) return game;
  if (game.flipped.includes(cardId)) return game;

  const flipped = [...game.flipped, cardId];
  if (flipped.length < 2) return { ...game, flipped };

  const a = game.cards.find((c) => c.id === flipped[0])!;
  const b = game.cards.find((c) => c.id === flipped[1])!;
  if (a.imageId === b.imageId) {
    const matched = [...game.matched, a.imageId];
    return {
      ...game,
      flipped: [],
      matched,
      status: matched.length >= game.pairs ? 'won' : 'playing',
    };
  }

  // Erreur : on garde les deux cartes visibles (l'UI les montre, puis appelle
  // `dismiss`), et on compte l'essai.
  const mistakes = game.mistakes + 1;
  return {
    ...game,
    flipped,
    mistakes,
    status: mistakes >= game.maxMistakes ? 'lost' : 'playing',
  };
}

/** Referme les deux cartes d'une erreur, une fois que l'UI les a montrées. */
export function dismiss(game: MemoryGame): MemoryGame {
  if (game.flipped.length !== 2) return game;
  return { ...game, flipped: [] };
}

/** Essais restants avant la défaite. */
export function triesLeft(game: MemoryGame): number {
  return Math.max(0, game.maxMistakes - game.mistakes);
}
