import { fetchMyFlashes, publishFlash, withdrawFlash } from '../lib/flash-api';
import { useMerchantStore } from '../model/store';

/**
 * La publication AVEC un serveur : l'offre part au serveur, et ce qu'il rend devient la vérité de
 * l'écran (liste et quota). Les brouillons restent sur le téléphone.
 */
jest.mock('@/shared/lib/env', () => ({
  ...jest.requireActual('@/shared/lib/env'),
  isSupabaseConfigured: true,
}));
jest.mock('../lib/flash-api', () => ({
  publishFlash: jest.fn(),
  fetchMyFlashes: jest.fn(),
  withdrawFlash: jest.fn(),
}));

const publish = publishFlash as jest.Mock;
const fetchMine = fetchMyFlashes as jest.Mock;
const withdraw = withdrawFlash as jest.Mock;

const DRAFT = {
  title: 'Plateau de viennoiseries',
  category: 'restauration' as const,
  priceCents: 900,
  oldPriceCents: 1800,
  stock: 6,
  durationMinutes: 60,
};
const served = (id: string, over: object = {}) => ({
  id,
  title: 'Plateau',
  category: 'restauration',
  priceCents: 900,
  oldPriceCents: 1800,
  stock: 6,
  stockLeft: 6,
  durationMinutes: 60,
  description: '',
  publishedAt: 1,
  startsAt: 0,
  state: 'publiee',
  offline: false,
  audience: 'clients',
  photoUri: '',
  modes: ['touch-collect'],
  seller: '',
  minQty: 1,
  recurrence: 'aucune',
  ...over,
});

const initial = useMerchantStore.getState();
beforeEach(() => {
  useMerchantStore.setState(initial, true);
  jest.clearAllMocks();
});

it('publie sur le serveur et compte l’opération', async () => {
  publish.mockResolvedValueOnce({ ok: true, value: served('f-1') });
  const res = await useMerchantStore.getState().publishOnline(DRAFT, 'Marc');
  expect(res).toEqual({ ok: true, offer: expect.objectContaining({ id: 'f-1', seller: 'Marc' }) });
  expect(useMerchantStore.getState().offers.map((o) => o.id)).toEqual(['f-1']);
  expect(useMerchantStore.getState().used).toBe(1);
});

it('un brouillon ne part pas au serveur', async () => {
  const res = await useMerchantStore.getState().publishOnline({ ...DRAFT, state: 'brouillon' });
  expect(res.ok).toBe(true);
  expect(publish).not.toHaveBeenCalled();
  expect(useMerchantStore.getState().used).toBe(0);
});

it('un refus du serveur ne publie rien et dit pourquoi', async () => {
  publish.mockResolvedValueOnce({ ok: false, code: 'not_validated' });
  expect(await useMerchantStore.getState().publishOnline(DRAFT)).toEqual({
    ok: false,
    reason: 'not_validated',
  });
  expect(useMerchantStore.getState().offers).toEqual([]);
});

it('la relecture prend la liste et le quota du serveur, et garde les brouillons', async () => {
  await useMerchantStore.getState().publishOnline({ ...DRAFT, state: 'brouillon' });
  fetchMine.mockResolvedValueOnce({
    ok: true,
    value: [served('f-2'), served('f-3', { audience: 'commercants' })],
  });
  await useMerchantStore.getState().refreshMyOffers();
  const { offers, used } = useMerchantStore.getState();
  expect(offers.map((o) => o.state)).toEqual(['publiee', 'publiee', 'brouillon']);
  // Seule la Flash des clients consomme une opération (CDC §9).
  expect(used).toBe(1);
});

it('retirer une offre publiée part au serveur', () => {
  useMerchantStore.setState({ offers: [served('f-1') as never] });
  withdraw.mockResolvedValueOnce({ ok: true, value: null });
  useMerchantStore.getState().takeOffline('f-1');
  expect(useMerchantStore.getState().offers[0]!.offline).toBe(true);
  expect(withdraw).toHaveBeenCalledWith('f-1');
});
