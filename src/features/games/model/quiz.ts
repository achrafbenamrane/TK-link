/**
 * Quiz « Le juste prix » — logique pure, sans UI ni aléa caché.
 *
 * Le principe : on montre une offre (emoji + titre), le joueur devine son prix
 * flash parmi plusieurs propositions. Assez de bonnes réponses → coupon gagné.
 *
 * Comme le jeu de mémoire, le contenu n'est PAS codé ici : les offres arrivent
 * en paramètre (`pool`), alimenté par le catalogue. Une offre ajoutée par un
 * commerçant devient donc automatiquement une question — prix réel à l'appui,
 * distracteurs tirés des autres offres.
 */

export type QuizItem = { id: string; title: string; price: number; emoji: string };

export type QuizQuestion = {
  id: string;
  title: string;
  emoji: string;
  /** Propositions de prix (euros), mélangées ; une seule est correcte. */
  choices: number[];
  correctIndex: number;
};

export type QuizGame = {
  questions: QuizQuestion[];
  /** Index de la question courante. */
  current: number;
  /** Réponse choisie par question (index dans `choices`), `null` si pas encore. */
  picks: (number | null)[];
  /** Bonnes réponses minimum pour gagner. */
  passMark: number;
  status: 'playing' | 'won' | 'lost';
};

export const DEFAULT_COUNT = 5;
export const CHOICES_PER_QUESTION = 4;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Réussite à 60 % (arrondi au supérieur) : engageant sans être gratuit. */
export function passMarkFor(questionCount: number): number {
  return Math.max(1, Math.ceil(questionCount * 0.6));
}

/**
 * Construit une question pour une offre : le vrai prix plus des distracteurs
 * tirés des prix des AUTRES offres (dédupliqués, jamais égaux au bon prix).
 */
function buildQuestion(item: QuizItem, pool: QuizItem[]): QuizQuestion {
  // Distracteurs = les prix des AUTRES offres les PLUS PROCHES du bon prix :
  // des propositions serrées rendent le choix plus difficile.
  const distractors = [...new Set(pool.map((d) => d.price))]
    .filter((p) => p !== item.price)
    .sort((a, b) => Math.abs(a - item.price) - Math.abs(b - item.price))
    .slice(0, CHOICES_PER_QUESTION - 1);

  const choices = shuffle([item.price, ...distractors]);
  return {
    id: item.id,
    title: item.title,
    emoji: item.emoji,
    choices,
    correctIndex: choices.indexOf(item.price),
  };
}

/**
 * Nouvelle partie : `count` offres tirées au hasard, une question chacune.
 * Fraîche à chaque appel — l'ordre et les propositions changent.
 */
export function newQuiz(pool: QuizItem[], count = DEFAULT_COUNT): QuizGame {
  const chosen = shuffle(pool).slice(0, Math.min(count, pool.length));
  const questions = chosen.map((item) => buildQuestion(item, pool));
  return {
    questions,
    current: 0,
    picks: questions.map(() => null),
    passMark: passMarkFor(questions.length),
    status: 'playing',
  };
}

export function currentQuestion(game: QuizGame): QuizQuestion | null {
  return game.questions[game.current] ?? null;
}

/** La question courante a-t-elle déjà reçu une réponse ? */
export function isAnswered(game: QuizGame): boolean {
  return game.picks[game.current] != null;
}

/** Nombre de bonnes réponses jusqu'ici. */
export function correctCount(game: QuizGame): number {
  return game.picks.reduce<number>(
    (n, pick, i) => (pick != null && pick === game.questions[i]!.correctIndex ? n + 1 : n),
    0,
  );
}

/**
 * Enregistre la réponse à la question courante. Sans effet si la partie est
 * finie ou si la question a déjà été répondue (pas de double comptage).
 */
export function answerCurrent(game: QuizGame, choiceIndex: number): QuizGame {
  if (game.status !== 'playing') return game;
  if (isAnswered(game)) return game;
  const q = currentQuestion(game);
  if (!q || choiceIndex < 0 || choiceIndex >= q.choices.length) return game;

  const picks = [...game.picks];
  picks[game.current] = choiceIndex;
  return { ...game, picks };
}

/**
 * Passe à la question suivante. À la dernière, clôt la partie : gagnée si le
 * nombre de bonnes réponses atteint le seuil, perdue sinon. Sans effet tant que
 * la question courante n'a pas reçu de réponse.
 */
export function next(game: QuizGame): QuizGame {
  if (game.status !== 'playing' || !isAnswered(game)) return game;
  if (game.current < game.questions.length - 1) {
    return { ...game, current: game.current + 1 };
  }
  return { ...game, status: correctCount(game) >= game.passMark ? 'won' : 'lost' };
}
