import {
  balanceOf,
  canClaim,
  formatCardNumber,
  isOfferLive,
  nextGift,
  pointsForCents,
  pointsMissing,
  POINTS_PER_EURO,
  progressToward,
  timeLeft,
} from '../lib/loyalty';
import type { Gift, Offer, PointsEntry } from '../model/schema';

const entry = (points: number, over: Partial<PointsEntry> = {}): PointsEntry => ({
  id: `e${points}`,
  points,
  label: 'test',
  at: 1_000,
  source: 'achat',
  ...over,
});

const gift = (over: Partial<Gift> = {}): Gift => ({
  id: 'g1',
  title: 'Café offert',
  partner: '',
  cost: 200,
  detail: '',
  audience: null,
  ...over,
});

describe('balanceOf', () => {
  it('somme gains et dépenses', () => {
    expect(balanceOf([entry(100), entry(50), entry(-30)])).toBe(120);
  });

  it('vaut 0 sans écriture', () => {
    expect(balanceOf([])).toBe(0);
  });
});

describe('pointsForCents', () => {
  it('donne 1 point par euro, arrondi à l’euro inférieur', () => {
    expect(pointsForCents(1000)).toBe(10);
    expect(pointsForCents(1099)).toBe(10);
    expect(pointsForCents(99)).toBe(0);
    expect(POINTS_PER_EURO).toBe(1);
  });
});

describe('canClaim', () => {
  it('exige un solde suffisant', () => {
    expect(canClaim(gift({ cost: 200 }), 200, 'particulier')).toBe(true);
    expect(canClaim(gift({ cost: 200 }), 199, 'particulier')).toBe(false);
  });

  it('respecte le public visé', () => {
    const proOnly = gift({ cost: 100, audience: 'pro' });
    expect(canClaim(proOnly, 999, 'particulier')).toBe(false);
    expect(canClaim(proOnly, 999, 'pro')).toBe(true);
    // audience null = ouvert à tous
    expect(canClaim(gift({ cost: 100 }), 999, 'pro')).toBe(true);
  });
});

describe('pointsMissing / progressToward', () => {
  it('calcule ce qui manque, sans passer sous zéro', () => {
    expect(pointsMissing(gift({ cost: 200 }), 50)).toBe(150);
    expect(pointsMissing(gift({ cost: 200 }), 500)).toBe(0);
  });

  it('borne la progression entre 0 et 1', () => {
    expect(progressToward(gift({ cost: 200 }), 0)).toBe(0);
    expect(progressToward(gift({ cost: 200 }), 100)).toBe(0.5);
    expect(progressToward(gift({ cost: 200 }), 999)).toBe(1);
    expect(progressToward(gift({ cost: 200 }), -50)).toBe(0);
  });

  it('ne divise pas par zéro sur un coût nul', () => {
    expect(progressToward(gift({ cost: 0 }), 0)).toBe(1);
  });
});

describe('nextGift', () => {
  const catalog = [
    gift({ id: 'a', cost: 100 }),
    gift({ id: 'b', cost: 300 }),
    gift({ id: 'c', cost: 500, audience: 'pro' }),
  ];

  it('propose le prochain palier accessible', () => {
    expect(nextGift(catalog, 150, 'particulier')?.id).toBe('b');
    expect(nextGift(catalog, 0, 'particulier')?.id).toBe('a');
  });

  it('ignore les cadeaux d’un autre public', () => {
    expect(nextGift(catalog, 400, 'particulier')).toBeNull();
    expect(nextGift(catalog, 400, 'pro')?.id).toBe('c');
  });
});

describe('formatCardNumber', () => {
  it('groupe par quatre', () => {
    expect(formatCardNumber('1234567812345678')).toBe('1234 5678 1234 5678');
    expect(formatCardNumber('123')).toBe('123');
  });
});

describe('offres', () => {
  const offer = (endsAt: number | null): Offer => ({
    id: 'o',
    merchant: 'M',
    title: 'T',
    claim: '-30 %',
    category: '',
    flash: true,
    endsAt,
  });

  it('sait si une offre est encore valable', () => {
    expect(isOfferLive(offer(null), 5_000)).toBe(true);
    expect(isOfferLive(offer(10_000), 5_000)).toBe(true);
    expect(isOfferLive(offer(1_000), 5_000)).toBe(false);
  });

  it('affiche un temps restant lisible', () => {
    const now = 1_000_000;
    expect(timeLeft(null, now)).toBe('');
    expect(timeLeft(now - 1, now)).toBe('terminé');
    expect(timeLeft(now + 12 * 60_000, now)).toBe('12 min');
    expect(timeLeft(now + 5 * 3_600_000, now)).toBe('5 h');
    expect(timeLeft(now + 3 * 86_400_000, now)).toBe('3 j');
  });
});
