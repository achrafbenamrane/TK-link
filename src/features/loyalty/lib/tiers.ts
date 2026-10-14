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
  /**
   * Le produit du commerçant choisi comme récompense, s'il y en a un. Facultatif :
   * une récompense peut rester un texte libre (« Autre récompense »).
   */
  productId?: string;
};

/**
 * L'unité de calcul du programme — CDC V1.1, Commerçant > Avantage par points :
 * « le commerçant choisit l'unité de calcul (achats ou euros cumulés) à la
 * création du programme ; ce choix n'est plus modifiable une fois en ligne ».
 */
export type ProgramUnit = 'euros' | 'achats';

export const PROGRAM_UNITS: ProgramUnit[] = ['euros', 'achats'];

export const UNIT_LABEL: Record<ProgramUnit, { title: string; rule: string }> = {
  euros: { title: 'Euros dépensés', rule: '1 € dépensé = 1 point' },
  achats: { title: 'Nombre d’achats', rule: '1 achat = 1 point' },
};

/** Jusqu'à quatre paliers — CDC V1.1 : « jusqu'à 4 paliers par défaut ». */
export const MAX_TIERS = 4;

/**
 * Les points d'une commande chez UN commerçant, selon l'unité de son programme.
 * `eurosPoints` est le montant des articles en euros (la livraison, le service
 * et le pourboire sont déjà exclus en amont, CDC V1.1 §Utilisateur).
 */
export function earnedPoints(unit: ProgramUnit, eurosPoints: number): number {
  if (eurosPoints <= 0) return 0;
  return unit === 'achats' ? 1 : eurosPoints;
}

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
 * Le numéro de ticket d'une récompense — `#R-AB12`, court et lisible à voix
 * haute au comptoir. Dérivé de l'identifiant (toujours le même pour la même
 * récompense), sans caractères qui se confondent (0/O, 1/I).
 */
export function rewardTicket(rewardId: string): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let h = 2166136261;
  for (let i = 0; i < rewardId.length; i++) {
    h ^= rewardId.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  let out = '';
  for (let i = 0; i < 4; i++) {
    out += alphabet[h % alphabet.length];
    h = Math.floor(h / alphabet.length);
  }
  return `#R-${out}`;
}
