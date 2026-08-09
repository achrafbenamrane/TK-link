/**
 * Fidélité PAR COMMERÇANT, en paliers — le modèle de la maquette du client.
 *
 * Chez un commerçant donné, on cumule des points et on débloque des avantages
 * successifs : 1/4 à 20 points, 2/4 à 60, 3/4 à 150, 4/4 à 200. Un palier
 * atteint reste « à réclamer » tant qu'on ne l'a pas pris ; les suivants
 * restent verrouillés.
 *
 * La fidélité est propre à CHAQUE enseigne : 113 points chez O'Tokyo ne
 * donnent rien chez le boulanger. C'est ce qui pousse à revenir au même
 * endroit — un solde global n'aurait pas cet effet.
 */

export type Tier = {
  /** Rang affiché : 1 pour « 1/4 ». */
  rank: number;
  /** Points nécessaires. */
  cost: number;
  /** Ce qu'on obtient. */
  reward: string;
};

/** Où en est un palier pour un solde donné. */
export type TierState = 'claimed' | 'available' | 'locked';

export function tierState(tier: Tier, points: number, claimedRanks: number[]): TierState {
  if (claimedRanks.includes(tier.rank)) return 'claimed';
  return points >= tier.cost ? 'available' : 'locked';
}

/** Le prochain palier à atteindre — `null` quand tout est débloqué. */
export function nextTier(tiers: Tier[], points: number): Tier | null {
  return [...tiers].sort((a, b) => a.cost - b.cost).find((t) => points < t.cost) ?? null;
}

/** Ce qu'il manque pour un palier (0 s'il est atteint). */
export function pointsToGo(tier: Tier, points: number): number {
  return Math.max(0, tier.cost - points);
}

/** Progression vers un palier, bornée à [0, 1]. */
export function tierProgress(tier: Tier, points: number): number {
  if (tier.cost <= 0) return 1;
  return Math.min(1, Math.max(0, points / tier.cost));
}

/**
 * Combien de paliers sont franchis — sert au « 2/4 » affiché en tête de carte.
 * On compte les paliers ATTEINTS, réclamés ou non : c'est le mérite, pas la
 * consommation, qui se mesure là.
 */
export function reachedCount(tiers: Tier[], points: number): number {
  return tiers.filter((t) => points >= t.cost).length;
}

/**
 * Retire des points pour un transfert vers un proche. Fonction pure : renvoie
 * le nouveau solde, ou `null` si le solde est insuffisant (on ne laisse jamais
 * un compte partir en négatif).
 */
export function withdraw(points: number, amount: number): number | null {
  if (amount <= 0 || amount > points) return null;
  return points - amount;
}

/** Code de transfert lisible, à donner au proche. */
export function transferCode(merchantId: string, amount: number, at: number): string {
  const raw = `${merchantId}|${amount}|${at}`;
  let h = 0;
  for (let i = 0; i < raw.length; i++) h = (h * 31 + raw.charCodeAt(i)) >>> 0;
  return `TK${h.toString(36).toUpperCase().slice(0, 6)}`;
}
