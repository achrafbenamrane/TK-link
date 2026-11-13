import { remainingMsAt } from '@/shared/ui/ticking-text';

import { countdownParts, formatCentiseconds, formatCountdown } from '../ui/components/countdown';

/**
 * Le compte à rebours des affiches.
 *
 * `countdownParts` alimente les trois blocs H / MIN / SEC. Deux exigences le
 * rendent testable plutôt que décoratif : chaque bloc doit TOUJOURS faire deux
 * caractères — sinon les cases changent de largeur en cours de décompte, sous
 * les yeux du client — et le découpage ne doit jamais désigner la mauvaise
 * unité, ce qui transformerait quinze minutes en quinze heures.
 */
describe('countdownParts', () => {
  it('rend trois blocs de deux chiffres, toujours', () => {
    const cases = [0, 5, 59, 60, 61, 3599, 3600, 3661, 86399];
    for (const total of cases) {
      const { h, m, s } = countdownParts(total);
      expect(h).toHaveLength(2);
      expect(m).toHaveLength(2);
      expect(s).toHaveLength(2);
    }
  });

  it('découpe les heures, minutes et secondes sans les confondre', () => {
    expect(countdownParts(0)).toEqual({ h: '00', m: '00', s: '00' });
    // 15 minutes : le cas exact des affiches — « 00:15:45 » ne doit pas se lire
    // quinze heures.
    expect(countdownParts(15 * 60 + 45)).toEqual({ h: '00', m: '15', s: '45' });
    expect(countdownParts(3661)).toEqual({ h: '01', m: '01', s: '01' });
    expect(countdownParts(28 * 60 + 45)).toEqual({ h: '00', m: '28', s: '45' });
  });

  it('ne descend jamais sous zéro', () => {
    expect(countdownParts(-42)).toEqual({ h: '00', m: '00', s: '00' });
  });

  it('reste cohérent avec le format compact', () => {
    const total = 2 * 3600 + 7 * 60 + 9;
    const { h, m, s } = countdownParts(total);
    expect(`${h}:${m}:${s}`).toBe(formatCountdown(total));
  });
});

describe('centièmes de seconde', () => {
  it('toujours deux chiffres, de 99 à 00', () => {
    expect(formatCentiseconds(899_990)).toBe('99');
    expect(formatCentiseconds(900_000)).toBe('00');
    expect(formatCentiseconds(1_050)).toBe('05');
    expect(formatCentiseconds(-3)).toBe('00');
  });
});

describe('remainingMsAt', () => {
  it('une vraie Flash s’arrête à zéro, sans repartir', () => {
    expect(remainingMsAt(1_000, 0, 0, 61_000)).toBe(60_000);
    expect(remainingMsAt(70_000, 0, 0, 61_000)).toBe(0);
  });

  it('une offre d’exemple boucle sur sa durée', () => {
    expect(remainingMsAt(10_000, 10_000, 900_000, 0)).toBe(900_000);
    expect(remainingMsAt(10_250, 10_000, 900_000, 0)).toBe(899_750);
    expect(remainingMsAt(10_000 + 900_000, 10_000, 900_000, 0)).toBe(900_000);
    expect(remainingMsAt(5, 0, 0, 0)).toBe(0);
  });
});
