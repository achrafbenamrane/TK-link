import { GAME_REWARDS, pickGameReward } from '../lib/rewards';

describe('table des lots de jeu', () => {
  it('tire toujours un lot du catalogue, bornes comprises', () => {
    expect(pickGameReward(0)).toBe(GAME_REWARDS[0]);
    expect(pickGameReward(0.999999)).toBe(GAME_REWARDS[GAME_REWARDS.length - 1]);
  });

  it('reste dans le catalogue même avec un tirage aberrant', () => {
    expect(GAME_REWARDS).toContain(pickGameReward(-1));
    expect(GAME_REWARDS).toContain(pickGameReward(2));
  });

  it('chaque lot donne une réduction ET des points — jamais l’un sans l’autre', () => {
    for (const r of GAME_REWARDS) {
      expect(r.points).toBeGreaterThan(0);
      expect(r.label.length).toBeGreaterThan(0);
      expect(r.discount.kind === 'amount' ? r.discount.cents : r.discount.pct).toBeGreaterThan(0);
    }
  });
});
