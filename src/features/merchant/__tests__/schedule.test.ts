import {
  DEFAULT_TOMORROW_HOUR,
  TOMORROW_HOURS,
  formatHour,
  minutesUntilTomorrowAt,
  tomorrowAt,
  FIRST_SLOT,
  LAST_SLOT,
  SLOT_STEP,
  defaultSlot,
  formatSlot,
  minutesUntilSlot,
  slotDate,
  slotsFor,
  scheduledStartMs,
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

describe('programmation simplifiée : un jour, un créneau', () => {
  const at = (h: number, m = 0) => new Date(2026, 10, 13, h, m, 0, 0); // 13 nov.

  it('aujourd’hui : seulement les créneaux à venir, à dix minutes au moins', () => {
    expect(slotsFor('aujourdhui', at(17, 10))[0]).toBe(17 * 60 + 30);
    expect(slotsFor('aujourdhui', at(17, 25))[0]).toBe(18 * 60);
    expect(slotsFor('aujourdhui', at(5, 0))[0]).toBe(FIRST_SLOT);
    expect(slotsFor('aujourdhui', at(17, 10)).at(-1)).toBe(LAST_SLOT);
  });

  it('trop tard aujourd’hui : aucun créneau, et pas de créneau d’office', () => {
    expect(slotsFor('aujourdhui', at(21, 55))).toEqual([]);
    expect(defaultSlot('aujourdhui', at(21, 55))).toBeNull();
  });

  it('demain : de 07:00 à 22:00, 09:00 d’office', () => {
    const slots = slotsFor('demain', at(23, 0));
    expect(slots[0]).toBe(FIRST_SLOT);
    expect(slots.at(-1)).toBe(LAST_SLOT);
    expect(slots).toHaveLength((LAST_SLOT - FIRST_SLOT) / SLOT_STEP + 1);
    expect(defaultSlot('demain', at(23, 0))).toBe(9 * 60);
  });

  it('compte les minutes jusqu’au créneau, jamais en négatif', () => {
    expect(minutesUntilSlot('aujourdhui', 18 * 60, at(17, 10))).toBe(50);
    expect(minutesUntilSlot('demain', 9 * 60 + 30, at(22, 0))).toBe(11 * 60 + 30);
    expect(minutesUntilSlot('aujourdhui', 18 * 60, at(18, 2))).toBe(0);
  });

  it('le dernier jour du mois passe au mois suivant', () => {
    const d = slotDate('demain', 600, new Date(2026, 10, 30, 20, 0));
    expect([d.getMonth(), d.getDate(), d.getHours()]).toEqual([11, 1, 10]);
  });

  it('écrit les créneaux en HH:MM', () => {
    expect(formatSlot(570)).toBe('09:30');
    expect(formatSlot(22 * 60)).toBe('22:00');
  });
});

describe('scheduledStartMs', () => {
  it('cale le début programmé sur la minute pleine', () => {
    // Formulaire ouvert à 06:56:40, créneau 07:30 → 33 min arrondies → 07:30:00 et non 07:29:40.
    const now = new Date(2026, 10, 13, 6, 56, 40).getTime();
    const start = new Date(scheduledStartMs(now, 33));
    expect([start.getHours(), start.getMinutes(), start.getSeconds()]).toEqual([7, 30, 0]);
  });
});
