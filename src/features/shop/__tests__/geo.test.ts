import { MERCHANTS } from '../model/catalog';
import { distanceKm, formatDistance, TOULOUSE_CENTER } from '../lib/geo';

describe('distanceKm', () => {
  it('is zero for the same point', () => {
    expect(distanceKm(TOULOUSE_CENTER, TOULOUSE_CENTER)).toBe(0);
  });

  it('matches a known real-world distance (Toulouse → Paris ≈ 588 km)', () => {
    const paris = { lat: 48.8566, lng: 2.3522 };
    expect(distanceKm(TOULOUSE_CENTER, paris)).toBeGreaterThan(570);
    expect(distanceKm(TOULOUSE_CENTER, paris)).toBeLessThan(600);
  });

  it('is symmetric', () => {
    const [first, second] = Object.values(MERCHANTS);
    if (!first || !second) throw new Error('catalogue vide');
    expect(distanceKm(first.coord, second.coord)).toBeCloseTo(
      distanceKm(second.coord, first.coord),
      10,
    );
  });
});

describe('merchant coordinates', () => {
  it('places every merchant within 10 km of Toulouse centre', () => {
    for (const m of Object.values(MERCHANTS)) {
      expect(distanceKm(TOULOUSE_CENTER, m.coord)).toBeLessThan(10);
    }
  });

  it('gives every merchant a distinct point, so bubbles never stack', () => {
    const seen = Object.values(MERCHANTS).map((m) => `${m.coord.lat},${m.coord.lng}`);
    expect(new Set(seen).size).toBe(seen.length);
  });
});

describe('formatDistance', () => {
  it('uses metres under 1 km', () => {
    expect(formatDistance(0.8)).toBe('800 m');
  });

  it('uses km with a French decimal comma above 1 km', () => {
    expect(formatDistance(1.24)).toBe('1,2 km');
  });
});
