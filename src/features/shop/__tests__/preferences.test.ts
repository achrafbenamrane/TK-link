import { PersistedShopSchema, RadiusSchema } from '../model/schema';
import {
  activeFilterCount,
  applyPreferences,
  DEFAULT_PREFERENCES,
  filterDeals,
  matchesLifeStyle,
  toggleLifeStyle,
  withinRadius,
  type Preferences,
  RADII,
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
    category: 'restauration',
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

describe('filterDeals — le rayon ne doit jamais vider l’écran', () => {
  // Le catalogue de démonstration est à Toulouse ; le testeur, lui, peut être
  // n’importe où. C’est exactement ce cas qui affichait « Aucune offre ».
  const toulouse = { lat: 43.6045, lng: 1.4442 };
  const alger = { lat: 36.7538, lng: 3.0588 };

  const merchants: Record<string, Merchant> = {
    m_halal: merchant({ id: 'm_halal', coord: toulouse, halal: true }),
    m_std: merchant({ id: 'm_std', coord: toulouse, halal: false }),
  };
  const lookup = (id: string) => merchants[id];

  const deals = [
    deal({ id: 'a', merchantId: 'm_halal', diet: ['vegetarien', 'vegan'] }),
    deal({ id: 'b', merchantId: 'm_std' }),
  ];

  it('élargit le rayon plutôt que de ne rien montrer, et le signale', () => {
    const out = filterDeals(deals, lookup, DEFAULT_PREFERENCES, alger);
    expect(out.deals).toHaveLength(2);
    expect(out.radiusRelaxed).toBe(true);
  });

  it('respecte le rayon dès qu’une offre est à portée', () => {
    const near: Record<string, Merchant> = {
      ...merchants,
      m_std: merchant({ id: 'm_std', coord: alger }),
    };
    const out = filterDeals(deals, (id) => near[id], DEFAULT_PREFERENCES, alger);
    expect(out.deals.map((d) => d.id)).toEqual(['b']);
    expect(out.radiusRelaxed).toBe(false);
  });

  it('n’élargit JAMAIS un régime — un vide alimentaire reste un vide', () => {
    const prefs: Preferences = { ...DEFAULT_PREFERENCES, lifestyle: ['vegan', 'halal'] };
    const carne = [deal({ id: 'c', merchantId: 'm_std' })];
    const out = filterDeals(carne, lookup, prefs, alger);
    expect(out.deals).toEqual([]);
    expect(out.radiusRelaxed).toBe(false);
  });

  it('combine les deux : le régime filtre, la distance s’efface', () => {
    const prefs: Preferences = { ...DEFAULT_PREFERENCES, lifestyle: ['halal'] };
    const out = filterDeals(deals, lookup, prefs, alger);
    expect(out.deals.map((d) => d.id)).toEqual(['a']);
    expect(out.radiusRelaxed).toBe(true);
  });

  it('sans position connue, rien n’est élargi', () => {
    expect(filterDeals(deals, lookup, DEFAULT_PREFERENCES, null)).toEqual({
      deals,
      radiusRelaxed: false,
    });
  });

  it('une liste vide au départ ne déclenche pas de faux élargissement', () => {
    expect(filterDeals([], lookup, DEFAULT_PREFERENCES, alger)).toEqual({
      deals: [],
      radiusRelaxed: false,
    });
  });
});

describe('activeFilterCount', () => {
  it('compte les écarts au réglage par défaut', () => {
    expect(activeFilterCount(DEFAULT_PREFERENCES)).toBe(0);
    expect(activeFilterCount({ ...DEFAULT_PREFERENCES, lifestyle: ['vegan'] })).toBe(1);
    expect(
      activeFilterCount({ collect: 'livraison', radiusKm: 10, lifestyle: ['vegan', 'halal'] }),
    ).toBe(4);
  });
});

describe('rayons — CDC V1.0 §3.2', () => {
  it('propose 1, 3, 5 et 10 km', () => {
    // Bien plus serré que les 5/10/15/30 d’avant. Le §3.2 en donne la raison :
    // « une bonne affaire n’a de valeur que si elle est accessible dans le
    // temps restant » — trente kilomètres pour une offre qui expire dans vingt
    // minutes n’est pas une offre.
    expect([...RADII]).toEqual([1, 3, 5, 10]);
  });

  it('rabat un ancien rayon enregistré au lieu d’effacer tout l’état', () => {
    // Un réglage à 15 ou 30 km traîne encore sur les téléphones. Le refuser
    // ferait échouer la réhydratation et emporterait panier, commandes et
    // favoris — pour un réglage d’affichage.
    expect(RadiusSchema.parse(15)).toBe(10);
    expect(RadiusSchema.parse(30)).toBe(10);
    expect(RadiusSchema.parse(3)).toBe(3);
  });

  it('refuse tout de même une valeur qui n’a jamais existé', () => {
    expect(() => RadiusSchema.parse(42)).toThrow();
  });
});

describe('le défaut d’objet et le défaut de champ disent la même chose', () => {
  it('un état SANS clé « preferences » se réhydrate sur le rayon par défaut', () => {
    // Ces deux défauts vivent à deux endroits différents du schéma : celui du
    // champ (`RadiusSchema.default`) et celui de l’objet entier. Les laisser
    // diverger afficherait une pastille « filtre actif » sur une installation
    // neuve, parce que le rayon rehydraté ne serait pas celui du réglage par
    // défaut. Personne ne cherche un bug là.
    const vide = PersistedShopSchema.parse({
      cart: [],
      favorites: [],
      orders: [],
      points: 0,
    });
    expect(vide.preferences.radiusKm).toBe(DEFAULT_PREFERENCES.radiusKm);
    expect(activeFilterCount(vide.preferences)).toBe(0);
  });
});
