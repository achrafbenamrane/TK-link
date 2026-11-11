import { supabase } from '@/shared/lib/supabase';

import { fetchMyFlashes, publishFlash, withdrawFlash } from '../lib/flash-api';
import { OfferDraftSchema } from '../model/schema';

/**
 * Les Flash du professionnel sur le serveur (`flash_offers`, migration 0011), contre un client
 * Supabase SIMULÉ. Ce qu'on prouve : seul un commerce validé publie, le téléphone n'envoie jamais
 * ce que le serveur calcule (stock restant, heure de fin), la photo part dans le dossier du compte,
 * et chaque refus devient une raison que l'écran sait dire.
 */
jest.mock('@/shared/lib/supabase', () => ({
  supabase: {
    auth: { getSession: jest.fn() },
    from: jest.fn(),
    storage: { from: jest.fn() },
  },
}));

const getSession = supabase.auth.getSession as jest.Mock;
const from = supabase.from as jest.Mock;
const storageFrom = supabase.storage.from as jest.Mock;

const NOW = Date.parse('2026-11-11T10:00:00Z');
const DRAFT = OfferDraftSchema.parse({
  title: 'Plateau de viennoiseries',
  category: 'restauration',
  priceCents: 900,
  oldPriceCents: 1800,
  stock: 6,
  durationMinutes: 60,
});

const ROW = {
  id: 'f-1',
  audience: 'clients',
  title: 'Plateau de viennoiseries',
  category: 'restauration',
  description: '',
  price_cents: 900,
  old_price_cents: 1800,
  stock_total: 6,
  stock_left: 6,
  min_qty: 1,
  duration_minutes: 60,
  starts_at: '2026-11-11T10:00:01Z',
  modes: ['touch-collect', 'livraison'],
  photo_url: null,
  recurrence: 'aucune',
  offline: false,
  created_at: '2026-11-11T10:00:00Z',
};

/** Une chaîne PostgREST qui se termine sur `result` (maybeSingle, single, ou `await` direct). */
function chain(result: { data: unknown; error: unknown }) {
  const q: Record<string, jest.Mock> & { then?: unknown } = {};
  for (const m of ['select', 'eq', 'insert', 'update', 'order', 'limit']) q[m] = jest.fn(() => q);
  q.maybeSingle = jest.fn().mockResolvedValue(result);
  q.single = jest.fn().mockResolvedValue(result);
  q.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return q;
}

const validatedShop = () => chain({ data: { id: 'shop-1', status: 'valide' }, error: null });

beforeEach(() => {
  jest.clearAllMocks();
  getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
});

describe('publishFlash', () => {
  it('un commerce non validé ne publie pas, et rien ne part', async () => {
    from.mockReturnValueOnce(
      chain({ data: { id: 'shop-1', status: 'en_verification' }, error: null }),
    );
    expect(await publishFlash(DRAFT, NOW)).toEqual({ ok: false, code: 'not_validated' });
    expect(from).toHaveBeenCalledTimes(1);
  });

  it('publie pour SON commerce, sans jamais envoyer le stock restant ni l’heure de fin', async () => {
    const insert = chain({ data: ROW, error: null });
    from.mockReturnValueOnce(validatedShop()).mockReturnValueOnce(insert);
    const res = await publishFlash(DRAFT, NOW);
    expect(res).toEqual({
      ok: true,
      value: expect.objectContaining({ id: 'f-1', stockLeft: 6, startsAt: 0, state: 'publiee' }),
    });
    const sent = insert.insert!.mock.calls[0][0];
    expect(sent).toEqual(
      expect.objectContaining({ shop_id: 'shop-1', price_cents: 900, duration_minutes: 60 }),
    );
    for (const key of ['stock_left', 'ends_at', 'starts_at', 'offline']) {
      expect(sent).not.toHaveProperty(key);
    }
  });

  it('programmée : une heure souhaitée part, le serveur fixe la fin', async () => {
    const insert = chain({ data: { ...ROW, starts_at: '2026-11-11T11:00:00Z' }, error: null });
    from.mockReturnValueOnce(validatedShop()).mockReturnValueOnce(insert);
    const res = await publishFlash({ ...DRAFT, startInMinutes: 60 }, NOW);
    expect(insert.insert!.mock.calls[0][0].starts_at).toBe('2026-11-11T11:00:00.000Z');
    expect(res.ok && res.value.startsAt).toBe(Date.parse('2026-11-11T11:00:00Z'));
  });

  it('la photo part dans le dossier du compte, puis son adresse publique accompagne l’offre', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      arrayBuffer: async () => new ArrayBuffer(4),
    }) as unknown as typeof fetch;
    const bucket = {
      upload: jest.fn().mockResolvedValue({ error: null }),
      getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://cdn.example/p.jpg' } })),
    };
    storageFrom.mockReturnValue(bucket);
    const insert = chain({ data: { ...ROW, photo_url: 'https://cdn.example/p.jpg' }, error: null });
    from.mockReturnValueOnce(validatedShop()).mockReturnValueOnce(insert);

    await publishFlash({ ...DRAFT, photoUri: 'file:///photo.jpg' }, NOW);
    expect(storageFrom).toHaveBeenCalledWith('flash-photos');
    expect(bucket.upload.mock.calls[0][0]).toMatch(/^u1\/.+\.jpg$/);
    expect(insert.insert!.mock.calls[0][0].photo_url).toBe('https://cdn.example/p.jpg');
  });

  it('quota épuisé : la raison est dite', async () => {
    from
      .mockReturnValueOnce(validatedShop())
      .mockReturnValueOnce(
        chain({ data: null, error: { code: 'P0001', message: 'quota_exhausted' } }),
      );
    expect(await publishFlash(DRAFT, NOW)).toEqual({ ok: false, code: 'quota' });
  });
});

describe('fetchMyFlashes / withdrawFlash', () => {
  it('relit les offres de SON commerce', async () => {
    const list = chain({ data: [ROW], error: null });
    from.mockReturnValueOnce(validatedShop()).mockReturnValueOnce(list);
    const res = await fetchMyFlashes();
    expect(res.ok && res.value.map((o) => o.id)).toEqual(['f-1']);
    expect(list.eq).toHaveBeenCalledWith('shop_id', 'shop-1');
  });

  it('pas encore validé : aucune offre, sans erreur', async () => {
    from.mockReturnValueOnce(chain({ data: null, error: null }));
    expect(await fetchMyFlashes()).toEqual({ ok: true, value: [] });
  });

  it('retirer une offre ne touche que la colonne « retirée »', async () => {
    const update = chain({ data: null, error: null });
    from.mockReturnValueOnce(update);
    expect(await withdrawFlash('f-1')).toEqual({ ok: true, value: null });
    expect(update.update).toHaveBeenCalledWith({ offline: true });
    expect(update.eq).toHaveBeenCalledWith('id', 'f-1');
  });
});
