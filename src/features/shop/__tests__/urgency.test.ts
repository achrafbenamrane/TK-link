import {
  countCritical,
  splitByInterests,
  discountPct,
  liquidationLabel,
  sortByUrgency,
  sortForInterests,
  stockRatio,
  urgencyOf,
} from '../lib/urgency';
import type { Deal } from '../model/schema';

const deal = (over: Partial<Deal> = {}): Deal =>
  ({
    id: 'd',
    title: 'Offre',
    merchantId: 'm',
    category: 'restauration',
    emoji: '🍔',
    tint: '#fff',
    price: 10,
    rating: 4,
    stockTotal: 100,
    stockLeft: 100,
    endsInSeconds: 7200,
    description: '',
    ...over,
  }) as Deal;

describe('stockRatio', () => {
  it('mesure la part restante', () => {
    expect(stockRatio(deal({ stockTotal: 100, stockLeft: 25 }))).toBe(0.25);
  });

  it('ne divise pas par zéro', () => {
    expect(stockRatio(deal({ stockTotal: 0, stockLeft: 0 }))).toBe(0);
  });

  it('reste borné même sur des données incohérentes', () => {
    expect(stockRatio(deal({ stockTotal: 10, stockLeft: 50 }))).toBe(1);
    expect(stockRatio(deal({ stockTotal: 10, stockLeft: -5 }))).toBe(0);
  });
});

describe('urgencyOf — deux signaux, le pire l’emporte', () => {
  it('est normale quand il reste du temps ET du stock', () => {
    expect(urgencyOf(deal({ endsInSeconds: 7200, stockLeft: 100 }))).toBe('normale');
  });

  it('devient critique par le TEMPS, stock plein', () => {
    expect(urgencyOf(deal({ endsInSeconds: 120, stockLeft: 100 }))).toBe('critique');
  });

  it('devient critique par le STOCK, temps large', () => {
    expect(urgencyOf(deal({ endsInSeconds: 7200, stockTotal: 100, stockLeft: 5 }))).toBe(
      'critique',
    );
  });

  it('reconnaît le palier « chaude »', () => {
    expect(urgencyOf(deal({ endsInSeconds: 900, stockLeft: 100 }))).toBe('chaude');
    expect(urgencyOf(deal({ endsInSeconds: 7200, stockTotal: 100, stockLeft: 30 }))).toBe('chaude');
  });

  it('un stock épuisé est toujours critique', () => {
    expect(urgencyOf(deal({ endsInSeconds: 99_999, stockLeft: 0 }))).toBe('critique');
  });
});

describe('liquidationLabel — dire POURQUOI le prix est tombé', () => {
  it('annonce le stock final quand il ne reste presque rien', () => {
    expect(liquidationLabel(deal({ stockTotal: 100, stockLeft: 2 }))).toBe('Stock final');
  });

  it('annonce la dernière chance quand c’est le temps qui manque', () => {
    expect(liquidationLabel(deal({ endsInSeconds: 60, stockLeft: 100 }))).toBe('Dernière chance');
  });

  it('reste sur « invendu sauvé » au repos', () => {
    expect(liquidationLabel(deal())).toBe('Invendu sauvé');
  });
});

describe('discountPct', () => {
  it('calcule la remise', () => {
    expect(discountPct(deal({ price: 10, oldPrice: 20 }))).toBe(50);
  });

  it('vaut null sans prix barré crédible', () => {
    expect(discountPct(deal({ price: 10 }))).toBeNull();
    expect(discountPct(deal({ price: 10, oldPrice: 10 }))).toBeNull();
    expect(discountPct(deal({ price: 10, oldPrice: 5 }))).toBeNull();
  });
});

describe('sortByUrgency', () => {
  const calme = deal({ id: 'calme', endsInSeconds: 7200 });
  const chaude = deal({ id: 'chaude', endsInSeconds: 900 });
  const critique = deal({ id: 'critique', endsInSeconds: 60 });

  it('met devant ce qui va disparaître', () => {
    expect(sortByUrgency([calme, chaude, critique]).map((d) => d.id)).toEqual([
      'critique',
      'chaude',
      'calme',
    ]);
  });

  it('départage à urgence égale par le temps restant', () => {
    const a = deal({ id: 'a', endsInSeconds: 200 });
    const b = deal({ id: 'b', endsInSeconds: 100 });
    expect(sortByUrgency([a, b]).map((d) => d.id)).toEqual(['b', 'a']);
  });

  it('ne mute pas la liste reçue', () => {
    const list = [calme, chaude, critique];
    const before = list.map((d) => d.id);
    sortByUrgency(list);
    expect(list.map((d) => d.id)).toEqual(before);
  });
});

describe('countCritical', () => {
  it('compte les dernières chances', () => {
    expect(
      countCritical([
        deal({ endsInSeconds: 60 }),
        deal({ stockTotal: 100, stockLeft: 1 }),
        deal({ endsInSeconds: 7200 }),
      ]),
    ).toBe(2);
  });
});

describe('sortForInterests — CDC §7', () => {
  const resto = deal({ id: 'resto', category: 'restauration', endsInSeconds: 7200 });
  const modeCalme = deal({ id: 'mode-calme', category: 'mode', endsInSeconds: 7200 });
  const modeUrgente = deal({ id: 'mode-urgente', category: 'mode', endsInSeconds: 60 });

  it('place les catégories déclarées devant, même moins urgentes', () => {
    // « mode » est déclaré : ses offres passent devant, y compris la calme,
    // sinon la personnalisation ne durerait que le temps d’un compte à rebours.
    expect(sortForInterests([resto, modeCalme, modeUrgente], ['mode']).map((d) => d.id)).toEqual([
      'mode-urgente',
      'mode-calme',
      'resto',
    ]);
  });

  it('garde l’urgence comme second critère à l’intérieur de chaque groupe', () => {
    const restoUrgent = deal({ id: 'resto-urgent', category: 'restauration', endsInSeconds: 30 });
    const out = sortForInterests([resto, restoUrgent, modeUrgente], ['mode']);
    expect(out.map((d) => d.id)).toEqual(['mode-urgente', 'resto-urgent', 'resto']);
  });

  it('retombe exactement sur l’urgence quand rien n’est déclaré', () => {
    const list = [resto, modeCalme, modeUrgente];
    expect(sortForInterests(list, []).map((d) => d.id)).toEqual(
      sortByUrgency(list).map((d) => d.id),
    );
  });

  it('ne perd aucune offre et ne mute pas la liste reçue', () => {
    const list = [resto, modeCalme, modeUrgente];
    const before = list.map((d) => d.id);
    expect(sortForInterests(list, ['mode'])).toHaveLength(3);
    expect(list.map((d) => d.id)).toEqual(before);
  });
});

describe('splitByInterests — CDC §7, précisé par le client', () => {
  const resto = deal({ id: 'a', category: 'restauration' });
  const tech = deal({ id: 'b', category: 'high-tech' });
  const mode = deal({ id: 'c', category: 'mode' });

  it('sans centre d’intérêt déclaré, tout reste ensemble', () => {
    const { forYou, others } = splitByInterests([resto, tech], []);
    expect(forYou).toHaveLength(2);
    expect(others).toHaveLength(0);
  });

  it('écarte réellement ce qui ne concerne pas l’utilisateur', () => {
    // La demande du client : « si tu es intéressé par le matériel
    // informatique, on ne va pas t'afficher les promotions des boucheries ».
    const { forYou, others } = splitByInterests([resto, tech, mode], ['high-tech']);
    expect(forYou.map((d) => d.id)).toEqual(['b']);
    expect(others.map((d) => d.id).sort()).toEqual(['a', 'c']);
  });

  it('ne supprime jamais rien : la somme reste le catalogue entier', () => {
    const all = [resto, tech, mode];
    const { forYou, others } = splitByInterests(all, ['mode']);
    expect(forYou.length + others.length).toBe(all.length);
  });

  it('trie chaque groupe par urgence, pas seulement le premier', () => {
    const calme = deal({ id: 'calme', category: 'mode', endsInSeconds: 9000, stockLeft: 40 });
    const urgent = deal({ id: 'urgent', category: 'mode', endsInSeconds: 60, stockLeft: 1 });
    const { forYou } = splitByInterests([calme, urgent], ['mode']);
    expect(forYou.map((d) => d.id)).toEqual(['urgent', 'calme']);
  });
});
