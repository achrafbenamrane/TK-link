import { badgesOf, earnedCount } from '../lib/badges';
import { EMPTY_COUNTS } from '../lib/progression';

const base = { xp: 0, streak: 0, counts: EMPTY_COUNTS, missionsDone: 0 };

const badge = (input: Parameters<typeof badgesOf>[0], id: string) =>
  badgesOf(input).find((b) => b.id === id)!;

describe('trophées', () => {
  it('un compte tout neuf n’a rien débloqué', () => {
    expect(earnedCount(badgesOf(base))).toBe(0);
  });

  it('la première visite débloque « Premier pas », et rien d’autre', () => {
    const badges = badgesOf({ ...base, xp: 10, counts: { ...EMPTY_COUNTS, visit: 1 } });
    expect(badges.find((b) => b.id === 'premier-pas')?.earned).toBe(true);
    expect(earnedCount(badges)).toBe(1);
  });

  it('attraper un invendu débloque « Première prise »', () => {
    expect(badge({ ...base, counts: { ...EMPTY_COUNTS, catch: 1 } }, 'premiere-prise').earned).toBe(
      true,
    );
  });

  it('les séries se débloquent à 3 puis 7 jours', () => {
    expect(badge({ ...base, streak: 3 }, 'serie-3').earned).toBe(true);
    expect(badge({ ...base, streak: 3 }, 'serie-7').earned).toBe(false);
    expect(badge({ ...base, streak: 7 }, 'serie-7').earned).toBe(true);
  });

  it('« Vétéran » attend 1 000 XP', () => {
    expect(badge({ ...base, xp: 999 }, 'mille-xp').earned).toBe(false);
    expect(badge({ ...base, xp: 1000 }, 'mille-xp').earned).toBe(true);
  });

  it('les verrouillés gardent leur consigne — c’est ce qui donne l’objectif', () => {
    const locked = badgesOf(base).filter((b) => !b.earned);
    expect(locked.length).toBeGreaterThan(0);
    for (const b of locked) expect(b.hint.length).toBeGreaterThan(0);
  });
});
