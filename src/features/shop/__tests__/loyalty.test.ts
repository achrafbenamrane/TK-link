import { REWARD_POINTS, REWARD_VALUE_EUR, useShopStore } from '../model/store';

beforeEach(() => {
  useShopStore.setState({ points: 0, vouchers: [] });
});

describe('claimReward', () => {
  it('refuses below the threshold and leaves the balance alone', () => {
    useShopStore.setState({ points: REWARD_POINTS - 1 });
    expect(useShopStore.getState().claimReward().ok).toBe(false);
    expect(useShopStore.getState().points).toBe(REWARD_POINTS - 1);
    expect(useShopStore.getState().vouchers).toEqual([]);
  });

  it('exchanges exactly the threshold for a voucher', () => {
    useShopStore.setState({ points: REWARD_POINTS });
    const r = useShopStore.getState().claimReward();
    expect(r.ok).toBe(true);
    expect(useShopStore.getState().points).toBe(0);
    const [v] = useShopStore.getState().vouchers;
    expect(v?.value).toBe(REWARD_VALUE_EUR);
    expect(v?.usedAt).toBeNull();
  });

  it('keeps the surplus instead of swallowing it', () => {
    useShopStore.setState({ points: REWARD_POINTS + 47 });
    useShopStore.getState().claimReward();
    expect(useShopStore.getState().points).toBe(47);
  });

  it('can be claimed twice when the balance allows it', () => {
    useShopStore.setState({ points: REWARD_POINTS * 2 });
    useShopStore.getState().claimReward();
    useShopStore.getState().claimReward();
    expect(useShopStore.getState().vouchers).toHaveLength(2);
    expect(useShopStore.getState().points).toBe(0);
  });

  it('gives every voucher a distinct code', () => {
    useShopStore.setState({ points: REWARD_POINTS * 3 });
    for (let i = 0; i < 3; i++) useShopStore.getState().claimReward();
    const codes = useShopStore.getState().vouchers.map((v) => v.code);
    expect(new Set(codes).size).toBe(3);
  });

  // Un code se lit au téléphone : 0/O et 1/I s'y confondent.
  it('builds codes without ambiguous characters', () => {
    useShopStore.setState({ points: REWARD_POINTS });
    useShopStore.getState().claimReward();
    expect(useShopStore.getState().vouchers[0]?.code).not.toMatch(/[O01I]/);
  });
});

describe('sharePoints', () => {
  it('deducts what was given and returns a code', () => {
    useShopStore.setState({ points: 100 });
    const r = useShopStore.getState().sharePoints(30);
    expect(r.ok).toBe(true);
    expect(useShopStore.getState().points).toBe(70);
  });

  // Le solde est la seule source de vérité : on ne crée pas de points ex nihilo.
  it('refuses more than the balance', () => {
    useShopStore.setState({ points: 10 });
    expect(useShopStore.getState().sharePoints(11).ok).toBe(false);
    expect(useShopStore.getState().points).toBe(10);
  });

  it('refuses zero, negatives and fractions', () => {
    useShopStore.setState({ points: 100 });
    for (const bad of [0, -5, 2.5]) {
      expect(useShopStore.getState().sharePoints(bad).ok).toBe(false);
    }
    expect(useShopStore.getState().points).toBe(100);
  });

  it('allows giving the whole balance', () => {
    useShopStore.setState({ points: 60 });
    expect(useShopStore.getState().sharePoints(60).ok).toBe(true);
    expect(useShopStore.getState().points).toBe(0);
  });
});
