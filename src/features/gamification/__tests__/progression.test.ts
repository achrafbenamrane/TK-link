import {
  bumpStreak,
  dailyMissions,
  dayKey,
  daysBetween,
  EMPTY_COUNTS,
  isStreakAlive,
  levelProgress,
  missionDone,
  missionRatio,
  missionsDone,
  nextRank,
  rankOf,
  RANKS,
  XP,
} from '../lib/progression';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();

describe('rangs', () => {
  it('donne le rang correspondant à l’XP', () => {
    expect(rankOf(0).level).toBe(1);
    expect(rankOf(99).level).toBe(1);
    expect(rankOf(100).level).toBe(2);
    expect(rankOf(2999).level).toBe(5);
    expect(rankOf(3000).level).toBe(6);
    expect(rankOf(999_999).level).toBe(6);
  });

  it('les seuils sont strictement croissants', () => {
    for (let i = 1; i < RANKS.length; i++) {
      expect(RANKS[i]!.minXp).toBeGreaterThan(RANKS[i - 1]!.minXp);
    }
  });

  it('annonce le rang suivant, null au sommet', () => {
    expect(nextRank(0)?.level).toBe(2);
    expect(nextRank(3000)).toBeNull();
  });
});

describe('levelProgress', () => {
  it('remplit la barre à l’intérieur du niveau', () => {
    // niveau 2 : de 100 à 300
    expect(levelProgress(100).ratio).toBe(0);
    expect(levelProgress(200).ratio).toBe(0.5);
    expect(levelProgress(200).toGo).toBe(100);
  });

  it('est pleine au dernier rang — jamais un reste trompeur', () => {
    expect(levelProgress(3000)).toEqual({ ratio: 1, toGo: 0 });
    expect(levelProgress(10_000)).toEqual({ ratio: 1, toGo: 0 });
  });
});

describe('séries', () => {
  it('démarre à 1 la première fois', () => {
    expect(bumpStreak({ count: 0, lastDay: null }, at(2026, 5, 10))).toEqual({
      count: 1,
      lastDay: '2026-05-10',
    });
  });

  it('ne bouge pas deux fois le même jour', () => {
    const s = { count: 3, lastDay: '2026-05-10' };
    expect(bumpStreak(s, at(2026, 5, 10, 23))).toBe(s);
  });

  it('incrémente le lendemain', () => {
    expect(bumpStreak({ count: 3, lastDay: '2026-05-10' }, at(2026, 5, 11)).count).toBe(4);
  });

  it('repart à 1 après une coupure — pas à 0, le jour courant compte', () => {
    expect(bumpStreak({ count: 9, lastDay: '2026-05-10' }, at(2026, 5, 13)).count).toBe(1);
  });

  it('franchit les mois', () => {
    expect(bumpStreak({ count: 2, lastDay: '2026-01-31' }, at(2026, 2, 1)).count).toBe(3);
  });

  it('sait si la série est encore vivante', () => {
    expect(isStreakAlive({ count: 2, lastDay: '2026-05-10' }, at(2026, 5, 11))).toBe(true);
    expect(isStreakAlive({ count: 2, lastDay: '2026-05-10' }, at(2026, 5, 13))).toBe(false);
    expect(isStreakAlive({ count: 0, lastDay: null }, at(2026, 5, 10))).toBe(false);
  });
});

describe('dates', () => {
  it('dayKey est stable dans la journée', () => {
    expect(dayKey(at(2026, 3, 7, 1))).toBe('2026-03-07');
    expect(dayKey(at(2026, 3, 7, 23))).toBe('2026-03-07');
  });

  it('daysBetween compte des jours civils', () => {
    expect(daysBetween(at(2026, 3, 7, 23), at(2026, 3, 8, 1))).toBe(1);
    expect(daysBetween(at(2026, 3, 7), at(2026, 3, 7))).toBe(0);
  });
});

describe('missions du jour', () => {
  it('en donne trois, distinctes', () => {
    const m = dailyMissions(at(2026, 4, 2));
    expect(m).toHaveLength(3);
    expect(new Set(m.map((x) => x.label)).size).toBe(3);
  });

  it('est déterministe : rouvrir l’app ne change pas les missions', () => {
    const a = dailyMissions(at(2026, 4, 2, 9));
    const b = dailyMissions(at(2026, 4, 2, 20));
    expect(a.map((x) => x.label)).toEqual(b.map((x) => x.label));
  });

  it('change d’un jour à l’autre', () => {
    const days = [3, 4, 5, 6, 7].map((d) =>
      dailyMissions(at(2026, 4, d))
        .map((m) => m.label)
        .join('|'),
    );
    expect(new Set(days).size).toBeGreaterThan(1);
  });

  it('mesure l’avancement et l’achèvement', () => {
    const mission = { id: 'x', kind: 'catch' as const, label: '', target: 2, xp: 10 };
    expect(missionRatio(mission, EMPTY_COUNTS)).toBe(0);
    expect(missionRatio(mission, { ...EMPTY_COUNTS, catch: 1 })).toBe(0.5);
    expect(missionRatio(mission, { ...EMPTY_COUNTS, catch: 5 })).toBe(1);
    expect(missionDone(mission, { ...EMPTY_COUNTS, catch: 2 })).toBe(true);
    expect(missionDone(mission, { ...EMPTY_COUNTS, catch: 1 })).toBe(false);
  });

  it('compte les missions accomplies', () => {
    const ms = dailyMissions(at(2026, 4, 2));
    expect(missionsDone(ms, EMPTY_COUNTS)).toBe(0);
    expect(missionsDone(ms, { catch: 9, game: 9, visit: 9 })).toBe(3);
  });
});

describe('barème', () => {
  it('récompense davantage une prise qu’une simple visite', () => {
    expect(XP.catch).toBeGreaterThan(XP.game);
    expect(XP.game).toBeGreaterThan(XP.visit);
  });
});
