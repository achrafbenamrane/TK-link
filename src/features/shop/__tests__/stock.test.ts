import {
  STOCK_CLASSES,
  STOCK_THRESHOLDS,
  stockAccessibilityLabel,
  stockBarPct,
  stockTone,
} from '../lib/stock';

/**
 * La jauge « d'essence ». Les seuils sont provisoires (le client enverra ses
 * formules) : ces tests figent les FRONTIÈRES, pas la valeur des seuils — le
 * jour où ils changent, on ajuste ici les chiffres, rien d'autre.
 */
describe('stockTone', () => {
  it('expose des seuils nommés', () => {
    expect(STOCK_THRESHOLDS).toEqual({ moitie: 0.5, reserve: 0.25 });
  });

  it('est « plein » strictement au-dessus de la moitié', () => {
    expect(stockTone(100, 100)).toBe('plein');
    expect(stockTone(51, 100)).toBe('plein');
  });

  it('bascule en « moitié » pile à 50 %', () => {
    expect(stockTone(50, 100)).toBe('moitie');
    expect(stockTone(26, 100)).toBe('moitie');
  });

  it('bascule dans la « réserve » pile à 25 %', () => {
    expect(stockTone(25, 100)).toBe('reserve');
    expect(stockTone(1, 100)).toBe('reserve');
    expect(stockTone(0, 100)).toBe('reserve');
  });

  it('un stock initial nul vaut la réserve, jamais « plein »', () => {
    expect(stockTone(0, 0)).toBe('reserve');
    expect(stockTone(5, 0)).toBe('reserve');
  });

  it('associe vert, jaune et rouge aux jetons de thème', () => {
    expect(STOCK_CLASSES.plein.bar).toBe('bg-success');
    expect(STOCK_CLASSES.moitie.bar).toBe('bg-warning');
    expect(STOCK_CLASSES.reserve.bar).toBe('bg-danger');
  });
});

describe('stockBarPct', () => {
  it('ne rend jamais une jauge invisible ni qui déborde', () => {
    expect(stockBarPct(0, 100)).toBe(6);
    expect(stockBarPct(0, 0)).toBe(6);
    expect(stockBarPct(50, 100)).toBe(50);
    expect(stockBarPct(500, 100)).toBe(100);
  });
});

describe('stockAccessibilityLabel', () => {
  it('dit le niveau en mots, la couleur ne suffisant pas', () => {
    expect(stockAccessibilityLabel(80, 100)).toBe('Stock : plein, 80 sur 100');
    expect(stockAccessibilityLabel(40, 100)).toBe('Stock : à moitié, 40 sur 100');
    expect(stockAccessibilityLabel(10, 100)).toBe('Stock : presque épuisé, 10 sur 100');
    expect(stockAccessibilityLabel(0, 100)).toBe('Stock : épuisé');
  });
});
