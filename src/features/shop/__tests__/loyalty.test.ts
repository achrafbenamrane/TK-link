import {
  ASSUMED_COMMISSION_RATE,
  netMarginRate,
  rewardRate,
  REWARD_POINTS,
  REWARD_VALUE_EUR,
} from '../model/loyalty';
import { useShopStore } from '../model/store';

beforeEach(() => {
  useShopStore.setState({ points: 0, vouchers: [] });
});

/**
 * Le garde-fou économique. Ces tests ne vérifient pas du code : ils vérifient
 * une décision d'affaires. Baisser le seuil ou gonfler le bon fait échouer la
 * suite — c'est voulu, ça force à revoir la commission d'abord.
 */
describe('économie du programme', () => {
  it('rend moins que ce que la commission encaisse', () => {
    expect(rewardRate()).toBeLessThan(ASSUMED_COMMISSION_RATE);
  });

  it('laisse une marge positive une fois la fidélité payée', () => {
    expect(netMarginRate()).toBeGreaterThan(0);
  });

  // Le programme ne doit pas dépendre des points oubliés : s'il est rentable
  // à 100 % d'utilisation, le partage entre proches ne coûte rien de plus.
  it('reste rentable si 100 % des points sont utilisés', () => {
    const revenue = 10_000;
    const pointsIssued = revenue * 1; // POINTS_PER_EURO
    const vouchersIfAllRedeemed = Math.floor(pointsIssued / REWARD_POINTS) * REWARD_VALUE_EUR;
    expect(vouchersIfAllRedeemed).toBeLessThan(revenue * ASSUMED_COMMISSION_RATE);
  });

  it('garde un seuil atteignable pour un panier de ventes flash', () => {
    // Au-delà de ~300 € de dépense avant la moindre récompense, le client
    // décroche : le programme cesse de fidéliser.
    expect(REWARD_POINTS).toBeLessThanOrEqual(300);
  });
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
