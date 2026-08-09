import {
  nextTier,
  pointsToGo,
  reachedCount,
  tierProgress,
  tierState,
  transferCode,
  withdraw,
  type Tier,
} from '../lib/tiers';

/** Les paliers de la maquette : 20 · 60 · 150 · 200. */
const TIERS: Tier[] = [
  { rank: 1, cost: 20, reward: '1 boisson 33 cl' },
  { rank: 2, cost: 60, reward: '2 miso soupes' },
  { rank: 3, cost: 150, reward: '4 californias saumon-cheese' },
  { rank: 4, cost: 200, reward: '8 californias saumon-cheese' },
];

describe('tierState — le cas de la maquette (113 points)', () => {
  it('ouvre les deux premiers paliers, verrouille les suivants', () => {
    expect(tierState(TIERS[0]!, 113, [])).toBe('available');
    expect(tierState(TIERS[1]!, 113, [])).toBe('available');
    expect(tierState(TIERS[2]!, 113, [])).toBe('locked');
    expect(tierState(TIERS[3]!, 113, [])).toBe('locked');
  });

  it('marque comme réclamé ce qui a déjà été pris', () => {
    expect(tierState(TIERS[0]!, 113, [1])).toBe('claimed');
    // Réclamé l'emporte même si le solde retombe sous le seuil.
    expect(tierState(TIERS[0]!, 0, [1])).toBe('claimed');
  });

  it('ouvre pile au seuil', () => {
    expect(tierState(TIERS[0]!, 19, [])).toBe('locked');
    expect(tierState(TIERS[0]!, 20, [])).toBe('available');
  });
});

describe('nextTier', () => {
  it('vise le prochain palier non atteint', () => {
    expect(nextTier(TIERS, 113)?.rank).toBe(3);
    expect(nextTier(TIERS, 0)?.rank).toBe(1);
    expect(nextTier(TIERS, 160)?.rank).toBe(4);
  });

  it('renvoie null quand tout est atteint', () => {
    expect(nextTier(TIERS, 200)).toBeNull();
    expect(nextTier(TIERS, 999)).toBeNull();
  });

  it('ne dépend pas de l’ordre de la liste', () => {
    const shuffled = [TIERS[3]!, TIERS[0]!, TIERS[2]!, TIERS[1]!];
    expect(nextTier(shuffled, 113)?.rank).toBe(3);
  });
});

describe('pointsToGo / tierProgress', () => {
  it('calcule ce qui manque', () => {
    expect(pointsToGo(TIERS[2]!, 113)).toBe(37);
    expect(pointsToGo(TIERS[0]!, 113)).toBe(0);
  });

  it('borne la progression entre 0 et 1', () => {
    expect(tierProgress(TIERS[2]!, 0)).toBe(0);
    expect(tierProgress(TIERS[2]!, 75)).toBe(0.5);
    expect(tierProgress(TIERS[2]!, 999)).toBe(1);
    expect(tierProgress({ rank: 0, cost: 0, reward: '' }, 0)).toBe(1);
  });
});

describe('reachedCount', () => {
  it('compte les paliers franchis — le « 2/4 » de la maquette', () => {
    expect(reachedCount(TIERS, 113)).toBe(2);
    expect(reachedCount(TIERS, 0)).toBe(0);
    expect(reachedCount(TIERS, 200)).toBe(4);
  });
});

describe('withdraw', () => {
  it('débite quand le solde suffit', () => {
    expect(withdraw(113, 20)).toBe(93);
    expect(withdraw(20, 20)).toBe(0);
  });

  it('refuse plutôt que de passer en négatif', () => {
    expect(withdraw(10, 20)).toBeNull();
    expect(withdraw(113, 0)).toBeNull();
    expect(withdraw(113, -5)).toBeNull();
  });
});

describe('transferCode', () => {
  it('est stable pour un même transfert et distinct sinon', () => {
    const a = transferCode('m_napoli', 20, 1000);
    expect(transferCode('m_napoli', 20, 1000)).toBe(a);
    expect(transferCode('m_napoli', 25, 1000)).not.toBe(a);
    expect(transferCode('m_xavier', 20, 1000)).not.toBe(a);
    expect(a).toMatch(/^TK[0-9A-Z]{1,6}$/);
  });
});
