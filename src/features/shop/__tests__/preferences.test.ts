import {
  activeFilterCount,
  applyPreferences,
  DEFAULT_PREFERENCES,
  matchesLifeStyle,
  toggleLifeStyle,
  withinRadius,
  type Preferences,
} from '../lib/preferences';
import type { Deal, Merchant } from '../model/schema';

const merchant = (over: Partial<Merchant> = {}): Merchant => ({
  id: 'm1',
  name: 'Test',
  area: 'Centre',
  coord: { lat: 43.6045, lng: 1.4442 },
  rating: 4.5,
  halal: false,
  emoji: '🍔',
  ...over,
});

const deal = (over: Partial<Deal> = {}): Deal =>
  ({
    id: 'd1',
    title: 'Plat',
    merchantId: 'm1',
    category: 'restos',
    emoji: '🍔',
    tint: '#fff',
    price: 10,
    rating: 4.5,
    stockTotal: 10,
    stockLeft: 5,
    endsInSeconds: 300,
    description: '',
    ...over,
  }) as Deal;

describe('toggleLifeStyle', () => {
  it('ajoute puis retire', () => {
    expect(toggleLifeStyle([], 'vegan')).toEqual(['vegan']);
    expect(toggleLifeStyle(['vegan'], 'vegan')).toEqual([]);
    expect(toggleLifeStyle(['vegan'], 'halal')).toEqual(['vegan', 'halal']);
  });
});

describe('matchesLifeStyle', () => {
  it('ne filtre rien quand aucun régime n’est coché', () => {
    expect(matchesLifeStyle(deal(), merchant(), [])).toBe(true);
  });

  it('lit le halal sur le COMMERÇANT, pas sur l’offre', () => {
    expect(matchesLifeStyle(deal(), merchant({ halal: true }), ['halal'])).toBe(true);
    expect(matchesLifeStyle(deal(), merchant({ halal: false }), ['halal'])).toBe(false);
  });

  it('accepte une offre vegan quand on demande végétarien', () => {
    expect(matchesLifeStyle(deal({ diet: ['vegan'] }), merchant(), ['vegetarien'])).toBe(true);
  });

  it('refuse une offre seulement végétarienne quand on demande vegan', () => {
    expect(matchesLifeStyle(deal({ diet: ['vegetarien'] }), merchant(), ['vegan'])).toBe(false);
  });

  it('exige TOUS les régimes cochés à la fois', () => {
    const veganDeal = deal({ diet: ['vegetarien', 'vegan'] });
    expect(matchesLifeStyle(veganDeal, merchant({ halal: true }), ['vegan', 'halal'])).toBe(true);
    // vegan OK mais commerçant non halal → exclu
    expect(matchesLifeStyle(veganDeal, merchant({ halal: false }), ['vegan', 'halal'])).toBe(false);
  });

  it('exclut une offre au régime non renseigné — jamais de faux positif', () => {
    expect(matchesLifeStyle(deal(), merchant(), ['vegetarien'])).toBe(false);
  });
});

describe('withinRadius', () => {
  const here = { lat: 43.6045, lng: 1.4442 };

  it('n’exclut rien sans position connue', () => {
    expect(withinRadius(merchant(), null, 5)).toBe(true);
  });

  it('garde ce qui est dans le rayon, écarte le reste', () => {
    // ~0 km
    expect(withinRadius(merchant({ coord: here }), here, 5)).toBe(true);
    // Blagnac, ~7 km de la place du Capitole
    const far = merchant({ coord: { lat: 43.6367, lng: 1.3928 } });
    expect(withinRadius(far, here, 5)).toBe(false);
    expect(withinRadius(far, here, 30)).toBe(true);
  });
});

describe('applyPreferences', () => {
  const merchants: Record<string, Merchant> = {
    m_halal: merchant({ id: 'm_halal', halal: true }),
    m_std: merchant({ id: 'm_std', halal: false }),
  };
  const lookup = (id: string) => merchants[id];

  const deals = [
    deal({ id: 'a', merchantId: 'm_halal', diet: ['vegetarien', 'vegan'] }),
    deal({ id: 'b', merchantId: 'm_std', diet: ['vegetarien'] }),
    deal({ id: 'c', merchantId: 'm_std' }),
  ];

  it('laisse tout passer par défaut', () => {
    expect(applyPreferences(deals, lookup, DEFAULT_PREFERENCES, null)).toHaveLength(3);
  });

  it('combine régime et halal', () => {
    const prefs: Preferences = { ...DEFAULT_PREFERENCES, lifestyle: ['vegan', 'halal'] };
    expect(applyPreferences(deals, lookup, prefs, null).map((d) => d.id)).toEqual(['a']);
  });

  it('ne filtre pas sur le mode de retrait (donnée absente)', () => {
    const prefs: Preferences = { ...DEFAULT_PREFERENCES, collect: 'livraison' };
    expect(applyPreferences(deals, lookup, prefs, null)).toHaveLength(3);
  });
});

describe('activeFilterCount', () => {
  it('compte les écarts au réglage par défaut', () => {
    expect(activeFilterCount(DEFAULT_PREFERENCES)).toBe(0);
    expect(activeFilterCount({ ...DEFAULT_PREFERENCES, lifestyle: ['vegan'] })).toBe(1);
    expect(
      activeFilterCount({ collect: 'livraison', radiusKm: 30, lifestyle: ['vegan', 'halal'] }),
    ).toBe(4);
  });
});
