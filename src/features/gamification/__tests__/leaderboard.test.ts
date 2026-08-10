import { neighbourhoodBoard, xpToPassNext, youRow } from '../lib/leaderboard';

const NOW = new Date(2026, 7, 10, 12).getTime();

describe('classement du quartier', () => {
  it('contient le joueur, une seule fois, avec son XP réel', () => {
    const rows = neighbourhoodBoard(500, NOW);
    expect(rows.filter((r) => r.you)).toHaveLength(1);
    expect(youRow(rows)?.xp).toBe(500);
  });

  it('est trié du plus fort au plus faible, rangs à partir de 1', () => {
    const rows = neighbourhoodBoard(500, NOW);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1]!.xp).toBeGreaterThanOrEqual(rows[i]!.xp);
    }
  });

  it('ne change pas d’un appel à l’autre le même jour', () => {
    expect(neighbourhoodBoard(500, NOW)).toEqual(neighbourhoodBoard(500, NOW + 3600_000));
  });

  it('laisse toujours quelqu’un devant et quelqu’un derrière dès les premiers points', () => {
    const me = youRow(neighbourhoodBoard(400, NOW))!;
    expect(me.rank).toBeGreaterThan(1);
    expect(me.rank).toBeLessThan(7);
  });

  it('un compte tout neuf est dernier, mais avec une cible atteignable', () => {
    const rows = neighbourhoodBoard(0, NOW);
    expect(youRow(rows)?.rank).toBe(rows.length);
    expect(xpToPassNext(rows)).toBeGreaterThan(0);
  });

  it('dit combien d’XP il manque pour doubler la ligne du dessus', () => {
    const rows = neighbourhoodBoard(300, NOW);
    const me = youRow(rows)!;
    const ahead = rows[me.rank - 2]!;
    expect(xpToPassNext(rows)).toBe(ahead.xp - me.xp + 1);
  });

  it('la première place reste atteignable — le quartier ne suit pas indéfiniment', () => {
    const rows = neighbourhoodBoard(10_000, NOW);
    expect(youRow(rows)?.rank).toBe(1);
    expect(xpToPassNext(rows)).toBe(0);
  });
});
