/**
 * Le coffre du jour — la récompense qui ne se mérite pas.
 *
 * Tout le reste de la progression demande un effort (attraper, jouer, revenir
 * plusieurs jours). Il faut aussi une raison d'ouvrir l'app qui rapporte
 * IMMÉDIATEMENT, sinon le premier jour ne donne rien et personne ne revient le
 * deuxième. Un coffre par jour, jamais deux.
 *
 * Tout est pur ici : le tirage dépend d'une graine passée en paramètre, jamais
 * de `Math.random()` — sinon la récompense serait intestable et un rendu
 * suffirait à la changer sous les yeux de l'utilisateur.
 */

export type ChestTierKey = 'bronze' | 'argent' | 'or';

export type ChestTier = {
  key: ChestTierKey;
  label: string;
  /** XP crédité par le coffre. */
  xp: number;
  /** Points de fidélité crédités — la route les verse au programme. */
  points: number;
  /** Poids du tirage. Plus il est haut, plus le palier est fréquent. */
  weight: number;
};

/**
 * Les paliers. Le bronze domine : un coffre qui donnerait souvent le meilleur
 * lot n'aurait aucune valeur, et l'or n'aurait plus rien d'un événement.
 */
export const CHEST_TIERS: ChestTier[] = [
  { key: 'bronze', label: 'Coffre bronze', xp: 20, points: 10, weight: 60 },
  { key: 'argent', label: 'Coffre argent', xp: 45, points: 25, weight: 30 },
  { key: 'or', label: 'Coffre or', xp: 90, points: 60, weight: 10 },
];

export type ChestReward = {
  tier: ChestTierKey;
  label: string;
  xp: number;
  points: number;
  /** Jour civil du tirage — sert à afficher « déjà ouvert aujourd'hui ». */
  day: string;
};

/** Hachage déterministe d'une graine numérique, dans [0, 1[. */
function unit(seed: number): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  h = Math.imul(h, 0x21f0aaad) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  h = Math.imul(h, 0x735a2d97) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  return h / 0x100000000;
}

/**
 * Tire un palier à partir d'une graine. Même graine = même palier : le coffre
 * ouvert ne peut pas changer d'avis si l'écran se rend à nouveau.
 */
export function rollChest(seed: number): ChestTier {
  const total = CHEST_TIERS.reduce((sum, t) => sum + t.weight, 0);
  let point = unit(seed) * total;
  for (const tier of CHEST_TIERS) {
    point -= tier.weight;
    if (point < 0) return tier;
  }
  return CHEST_TIERS[0]!;
}

/** Le coffre est-il disponible ? (dernier jour d'ouverture ≠ aujourd'hui) */
export function chestAvailable(lastDay: string | null, today: string): boolean {
  return lastDay !== today;
}
