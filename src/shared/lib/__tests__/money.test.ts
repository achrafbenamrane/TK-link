import { formatEuros } from '@/shared/lib/money';

describe('formatEuros', () => {
  it('écrit un prix à la française, l’euro collé par une espace insécable', () => {
    expect(formatEuros(24.9)).toBe('24,90 €');
    expect(formatEuros(0)).toBe('0,00 €');
    expect(formatEuros(1092)).toBe('1092,00 €');
  });
});
