import { fetchRoute, routeToGeoJSON, straightLine } from '../lib/directions';

// Sous Jest il n'y a pas de config Expo, donc pas de jeton : sans ce mock
// `fetchRoute` court-circuiterait vers la ligne droite et on ne testerait
// jamais le vrai chemin réseau. Getter (et non valeur figée) pour pouvoir
// aussi tester le cas « jeton absent » sans recharger les modules.
let mockToken = 'pk.test';
jest.mock('../lib/mapbox', () => ({
  get MAPBOX_PUBLIC_TOKEN() {
    return mockToken;
  },
  get hasMapboxToken() {
    return mockToken.startsWith('pk.');
  },
}));

const FROM = { lat: 43.6045, lng: 1.4442 }; // centre de Toulouse
const TO = { lat: 43.5766, lng: 1.4358 }; // Empalot

describe('straightLine', () => {
  it('flags itself as approximate and keeps [lng, lat] order for GeoJSON', () => {
    const r = straightLine(FROM, TO);
    expect(r.approximate).toBe(true);
    expect(r.coordinates).toEqual([
      [1.4442, 43.6045],
      [1.4358, 43.5766],
    ]);
  });

  it('never reports a zero-minute trip', () => {
    expect(straightLine(FROM, FROM).minutes).toBeGreaterThanOrEqual(1);
  });
});

describe('fetchRoute', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('uses the road geometry when the API answers', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        routes: [
          {
            geometry: {
              coordinates: [
                [1.44, 43.6],
                [1.43, 43.58],
              ],
            },
            distance: 4200,
            duration: 600,
          },
        ],
      }),
    }) as unknown as typeof fetch;

    const r = await fetchRoute(FROM, TO);
    expect(r.approximate).toBe(false);
    expect(r.km).toBeCloseTo(4.2, 5);
    expect(r.minutes).toBe(10);
    expect(r.coordinates).toHaveLength(2);
  });

  // Le catalogue marche hors-ligne : la carte ne doit jamais casser sur un
  // échec réseau — elle retombe sur la ligne droite.
  it('falls back to a straight line when the network fails', async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;
    const r = await fetchRoute(FROM, TO);
    expect(r.approximate).toBe(true);
    expect(r.km).toBeGreaterThan(0);
  });

  it('falls back when the API answers with an error status', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;
    expect((await fetchRoute(FROM, TO)).approximate).toBe(true);
  });

  it('falls back when the payload has no usable route', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ routes: [] }),
    }) as unknown as typeof fetch;
    expect((await fetchRoute(FROM, TO)).approximate).toBe(true);
  });
});

describe('fetchRoute without a token', () => {
  afterEach(() => {
    mockToken = 'pk.test';
  });

  // Un build mal configuré ne doit pas casser la carte : sans jeton on n'appelle
  // même pas l'API, on trace la ligne droite.
  it('falls back to a straight line and never calls the API', async () => {
    mockToken = '';
    const spy = jest.fn();
    globalThis.fetch = spy as unknown as typeof fetch;

    const r = await fetchRoute(FROM, TO);

    expect(r.approximate).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('routeToGeoJSON', () => {
  it('wraps the line in a Feature Mapbox can render', () => {
    const gj = routeToGeoJSON(straightLine(FROM, TO));
    expect(gj.type).toBe('Feature');
    expect(gj.geometry.type).toBe('LineString');
    expect(gj.geometry.coordinates).toHaveLength(2);
  });
});
