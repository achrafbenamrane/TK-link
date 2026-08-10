import type { Discount } from '../model/schema';

/**
 * Ce qu'une victoire rapporte — la table des lots, en UN seul endroit.
 *
 * Les jeux s'ouvrent depuis deux surfaces (l'onglet « La Chasse » et l'écran
 * « Jeux »). Si chaque route décidait de sa récompense, gagner au même jeu
 * paierait différemment selon l'endroit d'où l'on est parti — et personne ne
 * s'en apercevrait avant la caisse.
 */
export type GameReward = {
  discount: Discount;
  /** Étiquette portée par le coupon ET par l'écriture de points. */
  label: string;
  /** Points de fidélité crédités en plus du coupon. */
  points: number;
};

export const GAME_REWARDS: GameReward[] = [
  { discount: { kind: 'amount', cents: 200 }, label: 'Victoire au jeu', points: 50 },
  { discount: { kind: 'percent', pct: 10 }, label: 'Bien joué', points: 40 },
  { discount: { kind: 'amount', cents: 300 }, label: 'Score parfait', points: 75 },
];

/**
 * Tire un lot. Le hasard est injectable pour que les tests décrivent un
 * résultat plutôt que d'en attendre trois.
 */
export function pickGameReward(roll: number = Math.random()): GameReward {
  const clamped = Math.min(0.999999, Math.max(0, roll));
  return GAME_REWARDS[Math.floor(clamped * GAME_REWARDS.length)]!;
}
