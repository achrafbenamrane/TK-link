import {
  DEFAULT_TOMORROW_HOUR,
  TOMORROW_HOURS,
  formatHour,
  minutesUntilTomorrowAt,
  tomorrowAt,
} from '../lib/schedule';

describe('minutesUntilTomorrowAt', () => {
  it('compte de maintenant à demain à l’heure choisie', () => {
    const now = new Date(2026, 9, 14, 10, 0, 0, 0); // 14 oct. 10:00
    expect(minutesUntilTomorrowAt(9, now)).toBe(23 * 60); // demain 09:00
    expect(minutesUntilTomorrowAt(20, now)).toBe(34 * 60); // demain 20:00
  });

  it('tard le soir : 23:30 → demain 08:00 = 8 h 30', () => {
    const now = new Date(2026, 9, 14, 23, 30, 0, 0);
    expect(minutesUntilTomorrowAt(8, now)).toBe(8.5 * 60);
  });

  it('juste après minuit, demain reste le jour suivant (pas aujourd’hui)', () => {
    const now = new Date(2026, 9, 14, 0, 5, 0, 0);
    expect(minutesUntilTomorrowAt(9, now)).toBe(24 * 60 + 9 * 60 - 5);
  });

  it('passe le 31 décembre au 1er janvier', () => {
    const now = new Date(2026, 11, 31, 18, 0, 0, 0);
    const target = tomorrowAt(10, now);
    expect([target.getFullYear(), target.getMonth(), target.getDate()]).toEqual([2027, 0, 1]);
    expect(minutesUntilTomorrowAt(10, now)).toBe(16 * 60);
  });

  it('passe la fin d’un mois de 30 jours', () => {
    const target = tomorrowAt(9, new Date(2026, 3, 30, 12, 0, 0, 0));
    expect([target.getMonth(), target.getDate()]).toEqual([4, 1]);
  });

  it('février : le 28 en année non bissextile, le 29 en année bissextile', () => {
    const non = tomorrowAt(9, new Date(2026, 1, 28, 12, 0, 0, 0));
    expect([non.getMonth(), non.getDate()]).toEqual([2, 1]);

    const bis = tomorrowAt(9, new Date(2028, 1, 28, 12, 0, 0, 0));
    expect([bis.getMonth(), bis.getDate()]).toEqual([1, 29]);
    expect(minutesUntilTomorrowAt(9, new Date(2028, 1, 29, 12, 0, 0, 0))).toBe(21 * 60);
  });

  it('construit l’heure LOCALE de demain, quel que soit le décalage horaire du jour', () => {
    // Autour d’un changement d’heure, « demain à 09:00 » doit rester 09:00 locale, même si
    // l’écart vaut 23 h ou 25 h. Vrai quel que soit le fuseau de la machine de test.
    for (const start of [
      new Date(2026, 2, 28, 12, 0, 0, 0),
      new Date(2026, 9, 24, 12, 0, 0, 0),
      new Date(2026, 2, 29, 12, 0, 0, 0),
      new Date(2026, 9, 25, 12, 0, 0, 0),
    ]) {
      const target = tomorrowAt(9, start);
      expect(target.getHours()).toBe(9);
      expect(target.getMinutes()).toBe(0);
      expect(target.getDate()).toBe(new Date(start.getTime() + 24 * 3_600_000).getDate());
      expect(target.getTime() - start.getTime()).toBe(minutesUntilTomorrowAt(9, start) * 60_000);
    }
  });

  it('renvoie un entier, même avec des secondes dans l’horloge', () => {
    const now = new Date(2026, 9, 14, 10, 0, 40, 500);
    const m = minutesUntilTomorrowAt(9, now);
    expect(Number.isInteger(m)).toBe(true);
    expect(m).toBe(23 * 60 - 1); // 22 h 59 min 19,5 s → arrondi à la minute
  });

  it('propose 08:00 → 20:00 par heures rondes, 09:00 par défaut', () => {
    expect(TOMORROW_HOURS[0]).toBe(8);
    expect(TOMORROW_HOURS[TOMORROW_HOURS.length - 1]).toBe(20);
    expect(TOMORROW_HOURS).toHaveLength(13);
    expect(TOMORROW_HOURS).toContain(DEFAULT_TOMORROW_HOUR);
    expect(formatHour(9)).toBe('09:00');
    expect(formatHour(20)).toBe('20:00');
  });
});
