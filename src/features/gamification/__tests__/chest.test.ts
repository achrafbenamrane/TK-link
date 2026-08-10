import { CHEST_TIERS, chestAvailable, rollChest } from '../lib/chest';
import { dayKey } from '../lib/progression';
import { useGameStore } from '../model/store';

describe('coffre du jour — tirage', () => {
  it('rend toujours un palier connu', () => {
    for (let seed = 0; seed < 200; seed++) {
      expect(CHEST_TIERS).toContainEqual(rollChest(seed));
    }
  });

  it('est déterministe : même graine, même palier', () => {
    expect(rollChest(4242)).toBe(rollChest(4242));
  });

  it('donne le bronze bien plus souvent que l’or', () => {
    const counts = { bronze: 0, argent: 0, or: 0 };
    for (let seed = 0; seed < 3000; seed++) counts[rollChest(seed).key] += 1;
    expect(counts.bronze).toBeGreaterThan(counts.argent);
    expect(counts.argent).toBeGreaterThan(counts.or);
  });

  it('disponible tant que le dernier jour d’ouverture n’est pas aujourd’hui', () => {
    expect(chestAvailable(null, '2026-08-10')).toBe(true);
    expect(chestAvailable('2026-08-09', '2026-08-10')).toBe(true);
    expect(chestAvailable('2026-08-10', '2026-08-10')).toBe(false);
  });
});

describe('coffre du jour — store', () => {
  beforeEach(() => useGameStore.getState().resetDemo());

  it('crédite l’XP et mémorise le jour d’ouverture', () => {
    const now = new Date(2026, 7, 10, 9).getTime();
    const reward = useGameStore.getState().openChest(now);

    expect(reward).not.toBeNull();
    expect(useGameStore.getState().xp).toBe(reward!.xp);
    expect(useGameStore.getState().lastChest?.day).toBe(dayKey(now));
  });

  it('refuse un deuxième coffre le même jour, sans rien créditer', () => {
    const now = new Date(2026, 7, 10, 9).getTime();
    useGameStore.getState().openChest(now);
    const xpAfterFirst = useGameStore.getState().xp;

    expect(useGameStore.getState().openChest(now + 3600_000)).toBeNull();
    expect(useGameStore.getState().xp).toBe(xpAfterFirst);
  });

  it('rouvre le lendemain et fait avancer la série', () => {
    const day1 = new Date(2026, 7, 10, 9).getTime();
    const day2 = new Date(2026, 7, 11, 9).getTime();

    useGameStore.getState().openChest(day1);
    expect(useGameStore.getState().streakCount).toBe(1);

    expect(useGameStore.getState().openChest(day2)).not.toBeNull();
    expect(useGameStore.getState().streakCount).toBe(2);
  });
});
