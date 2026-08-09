import { flashLabel, searchSummaries, sortSummaries, summarize } from '../lib/browse';
import type { Deal, Merchant } from '../model/schema';

const CAPITOLE = { lat: 43.6045, lng: 1.4442 };

const merchant = (id: string, over: Partial<Merchant> = {}): Merchant => ({
  id,
  name: id,
  area: 'Centre',
  coord: CAPITOLE,
  rating: 4,
  halal: false,
  emoji: '🍔',
  ...over,
});

const deal = (id: string, merchantId: string, over: Partial<Deal> = {}): Deal =>
  ({
    id,
    title: id,
    merchantId,
    category: 'restos',
    emoji: '🍔',
    tint: '#fff',
    price: 10,
    rating: 4,
    stockTotal: 10,
    stockLeft: 5,
    endsInSeconds: 300,
    description: '',
    ...over,
  }) as Deal;

const MERCHANTS: Record<string, Merchant> = {
  a: merchant('a', { rating: 4.9 }),
  b: merchant('b', { rating: 3.2, coord: { lat: 43.6367, lng: 1.3928 } }), // Blagnac
};
const lookup = (id: string) => MERCHANTS[id];

describe('summarize', () => {
  const deals = [
    deal('d1', 'a', { endsInSeconds: 600, oldPrice: 20, price: 10 }),
    deal('d2', 'a', { endsInSeconds: 120, category: 'courses' }),
    deal('d3', 'b', { endsInSeconds: 900 }),
  ];

  it('compte les flashs par enseigne', () => {
    const s = summarize(deals, lookup, null);
    expect(s.find((x) => x.merchant.id === 'a')?.flashCount).toBe(2);
    expect(s.find((x) => x.merchant.id === 'b')?.flashCount).toBe(1);
  });

  it('retient la plus proche échéance et la meilleure remise', () => {
    const a = summarize(deals, lookup, null).find((x) => x.merchant.id === 'a')!;
    expect(a.endsInSeconds).toBe(120);
    expect(a.bestDiscount).toBe(50);
  });

  it('dédoublonne les catégories', () => {
    const a = summarize(deals, lookup, null).find((x) => x.merchant.id === 'a')!;
    expect(a.categories.sort()).toEqual(['courses', 'restos']);
  });

  it('calcule la distance quand la position est connue, null sinon', () => {
    expect(summarize(deals, lookup, null)[0]!.distanceKm).toBeNull();
    const withPos = summarize(deals, lookup, CAPITOLE);
    expect(withPos.find((x) => x.merchant.id === 'a')!.distanceKm).toBeCloseTo(0, 1);
    expect(withPos.find((x) => x.merchant.id === 'b')!.distanceKm).toBeGreaterThan(4);
  });

  it('ignore une enseigne absente du catalogue', () => {
    expect(summarize([deal('x', 'inconnu')], lookup, null)).toHaveLength(0);
  });

  it('ne renvoie rien sans offre en cours — ce n’est pas un annuaire', () => {
    expect(summarize([], lookup, null)).toEqual([]);
  });
});

describe('sortSummaries', () => {
  const base = summarize(
    [deal('d1', 'a', { endsInSeconds: 600 }), deal('d2', 'b', { endsInSeconds: 120 })],
    lookup,
    CAPITOLE,
  );

  it('« dernières chances » met la fin la plus proche en tête', () => {
    expect(sortSummaries(base, 'derniere-chance')[0]!.merchant.id).toBe('b');
  });

  it('« proximité » classe par distance', () => {
    expect(sortSummaries(base, 'proximite')[0]!.merchant.id).toBe('a');
  });

  it('« note » classe par étoiles', () => {
    expect(sortSummaries(base, 'note')[0]!.merchant.id).toBe('a');
  });

  it('ne mute pas la liste reçue', () => {
    const before = base.map((s) => s.merchant.id);
    sortSummaries(base, 'note');
    expect(base.map((s) => s.merchant.id)).toEqual(before);
  });
});

describe('searchSummaries', () => {
  const deals = [deal('d1', 'a', { title: 'Pizza reine' }), deal('d2', 'b', { title: 'Tacos' })];
  const base = summarize(deals, lookup, null);

  it('rend tout pour une requête vide', () => {
    expect(searchSummaries(base, deals, '  ')).toHaveLength(2);
  });

  it('cherche dans le nom de l’enseigne et dans ses offres', () => {
    expect(searchSummaries(base, deals, 'pizza').map((s) => s.merchant.id)).toEqual(['a']);
    expect(searchSummaries(base, deals, 'b').map((s) => s.merchant.id)).toEqual(['b']);
  });
});

describe('flashLabel', () => {
  it('accorde le pluriel', () => {
    expect(flashLabel(1)).toBe('1 FLASH');
    expect(flashLabel(3)).toBe('3 FLASHS');
  });
});
