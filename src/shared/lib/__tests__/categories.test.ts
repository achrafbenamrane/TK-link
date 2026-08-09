import {
  CATEGORIES,
  CATEGORY_INFO,
  CATEGORY_LABELS,
  isCategory,
  matchesInterests,
} from '../categories';

describe('catégories — CDC §4 et §23 Q2', () => {
  it('en expose exactement huit', () => {
    expect(CATEGORIES).toHaveLength(8);
  });

  it('reprend les libellés proposés au client', () => {
    expect(CATEGORY_INFO.restauration.label).toBe('Restauration & Alimentation');
    expect(CATEGORY_INFO['high-tech'].label).toBe('High-Tech & Électronique');
    expect(CATEGORY_INFO.services.label).toBe('Services & Expériences');
  });

  it('donne à chacune un libellé court, un emoji et une icône', () => {
    for (const c of CATEGORIES) {
      const info = CATEGORY_INFO[c];
      expect(info.short.length).toBeGreaterThan(0);
      expect(info.emoji.length).toBeGreaterThan(0);
      expect(info.icon.length).toBeGreaterThan(0);
    }
  });

  it('garde les libellés courts assez courts pour la barre de filtres', () => {
    // La tuile fait 76 px : au-delà de ~10 caractères le texte est tronqué.
    for (const c of CATEGORIES) expect(CATEGORY_INFO[c].short.length).toBeLessThanOrEqual(10);
  });

  it('n’a pas deux fois le même libellé court', () => {
    const shorts = CATEGORIES.map((c) => CATEGORY_INFO[c].short);
    expect(new Set(shorts).size).toBe(shorts.length);
  });

  it('dérive CATEGORY_LABELS des libellés courts', () => {
    expect(CATEGORY_LABELS.restauration).toBe('Resto');
    expect(Object.keys(CATEGORY_LABELS)).toHaveLength(8);
  });
});

describe('isCategory', () => {
  it('reconnaît les catégories connues', () => {
    expect(isCategory('mode')).toBe(true);
  });

  it('rejette une valeur ancienne ou inventée', () => {
    // Les identifiants d’avant le CDC ne doivent plus passer.
    expect(isCategory('restos')).toBe(false);
    expect(isCategory('artisans')).toBe(false);
    expect(isCategory('')).toBe(false);
  });
});

describe('matchesInterests — CDC §7', () => {
  it('ne filtre rien quand rien n’est déclaré', () => {
    expect(matchesInterests('mode', [])).toBe(true);
  });

  it('retient les catégories déclarées', () => {
    expect(matchesInterests('mode', ['mode', 'sport'])).toBe(true);
    expect(matchesInterests('auto', ['mode', 'sport'])).toBe(false);
  });
});
