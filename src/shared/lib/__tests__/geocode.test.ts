import { geocodeAddress } from '@/shared/lib/geocode';

/**
 * L'adresse d'un commerce en coordonnées (Mapbox). Un échec ne doit jamais bloquer le dépôt du
 * dossier : il rend `null`.
 */
const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

it('rend la latitude et la longitude du premier résultat (Mapbox donne [lng, lat])', async () => {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ features: [{ geometry: { coordinates: [1.444, 43.5965] } }] }),
  });
  expect(await geocodeAddress('8 rue des Carmes, 31000 Toulouse', 'pk.test')).toEqual({
    lat: 43.5965,
    lng: 1.444,
  });
  const url = String(fetchMock.mock.calls[0][0]);
  expect(url).toContain('country=fr');
  expect(url).toContain(encodeURIComponent('8 rue des Carmes, 31000 Toulouse'));
});

it('sans jeton public, ne demande rien', async () => {
  expect(await geocodeAddress('8 rue des Carmes', '')).toBeNull();
  expect(await geocodeAddress('8 rue des Carmes', 'sk.secret')).toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();
});

it('adresse introuvable, réponse illisible ou réseau coupé : null', async () => {
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ features: [] }) });
  expect(await geocodeAddress('nulle part', 'pk.test')).toBeNull();
  fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) });
  expect(await geocodeAddress('8 rue des Carmes', 'pk.test')).toBeNull();
  fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
  expect(await geocodeAddress('8 rue des Carmes', 'pk.test')).toBeNull();
});
