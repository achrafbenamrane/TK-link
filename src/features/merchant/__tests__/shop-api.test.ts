import { supabase } from '@/shared/lib/supabase';

import { classifyShopError, fetchMyShop, fileMyShop, type ShopFiling } from '../lib/shop-api';

/**
 * Le dossier du professionnel sur le serveur (table `shops`, migration 0010), contre un client
 * Supabase SIMULÉ. Ce qu'on prouve : le téléphone n'écrit jamais le statut, il relit celui du
 * serveur, et chaque refus du serveur devient un code que l'écran sait dire.
 */
jest.mock('@/shared/lib/supabase', () => ({
  supabase: {
    auth: { getSession: jest.fn() },
    from: jest.fn(),
  },
}));

const getSession = supabase.auth.getSession as jest.Mock;
const from = supabase.from as jest.Mock;

const ROW = {
  id: 'shop-1',
  kind: 'commercant',
  name: 'Le Petit Toulousain',
  category: 'restauration',
  siret: '44306184100047',
  address: '8 rue des Carmes, 31000 Toulouse',
  area: 'Toulouse',
  modes: ['touch-collect'],
  status: 'en_verification',
  review_note: null,
};

const FILING: ShopFiling = {
  kind: 'commercant',
  name: ' Le Petit Toulousain ',
  category: 'restauration',
  siret: '443 061 841 00047',
  address: '8 rue des Carmes, 31000 Toulouse',
  area: 'Toulouse',
  modes: ['touch-collect'],
};

/** Une chaîne PostgREST qui se termine par `maybeSingle()` ou `single()` sur `result`. */
function chain(result: { data: unknown; error: unknown }) {
  const q: Record<string, jest.Mock> = {};
  for (const m of ['select', 'eq', 'insert', 'update']) q[m] = jest.fn(() => q);
  q.maybeSingle = jest.fn().mockResolvedValue(result);
  q.single = jest.fn().mockResolvedValue(result);
  return q;
}

beforeEach(() => {
  jest.clearAllMocks();
  getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
});

describe('fetchMyShop', () => {
  it('relit le dossier de la personne connectée, statut du serveur compris', async () => {
    const q = chain({
      data: { ...ROW, status: 'refuse', review_note: 'SIRET radié' },
      error: null,
    });
    from.mockReturnValueOnce(q);
    const res = await fetchMyShop();
    expect(res).toEqual({
      ok: true,
      value: expect.objectContaining({ status: 'refuse', reviewNote: 'SIRET radié' }),
    });
    expect(q.eq).toHaveBeenCalledWith('owner_id', 'u1');
  });

  it('aucun dossier : null, pas une erreur', async () => {
    from.mockReturnValueOnce(chain({ data: null, error: null }));
    expect(await fetchMyShop()).toEqual({ ok: true, value: null });
  });

  it('sans session serveur, ne demande rien', async () => {
    getSession.mockResolvedValueOnce({ data: { session: null } });
    expect(await fetchMyShop()).toEqual({ ok: false, code: 'not_signed_in' });
    expect(from).not.toHaveBeenCalled();
  });

  it('une réponse au mauvais format est refusée, pas propagée', async () => {
    from.mockReturnValueOnce(chain({ data: { ...ROW, status: 'admin' }, error: null }));
    expect(await fetchMyShop()).toEqual({ ok: false, code: 'unknown' });
  });
});

describe('fileMyShop', () => {
  it('premier dépôt : insère le dossier, sans jamais envoyer de statut', async () => {
    const existing = chain({ data: null, error: null });
    const insert = chain({ data: ROW, error: null });
    from.mockReturnValueOnce(existing).mockReturnValueOnce(insert);
    const res = await fileMyShop(FILING);
    expect(res.ok).toBe(true);
    const sent = insert.insert!.mock.calls[0][0];
    expect(sent).toEqual({
      kind: 'commercant',
      name: 'Le Petit Toulousain',
      category: 'restauration',
      siret: '44306184100047',
      address: '8 rue des Carmes, 31000 Toulouse',
      area: 'Toulouse',
      modes: ['touch-collect'],
    });
    expect(sent).not.toHaveProperty('status');
  });

  it('dossier existant : le corrige, sans changer de type de compte', async () => {
    const existing = chain({ data: { id: 'shop-1' }, error: null });
    const update = chain({ data: ROW, error: null });
    from.mockReturnValueOnce(existing).mockReturnValueOnce(update);
    await fileMyShop(FILING);
    expect(update.update).toHaveBeenCalledWith(
      expect.not.objectContaining({ kind: expect.anything() }),
    );
    expect(update.eq).toHaveBeenCalledWith('id', 'shop-1');
  });

  it('un SIRET déjà déposé par un autre compte est classé', async () => {
    from
      .mockReturnValueOnce(chain({ data: null, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: { code: '23505', message: 'duplicate' } }));
    expect(await fileMyShop(FILING)).toEqual({ ok: false, code: 'siret_taken' });
  });
});

describe('classifyShopError', () => {
  it('traduit chaque refus du serveur', () => {
    expect(classifyShopError({ code: '23514', message: 'SIRET invalide' })).toBe('invalid');
    expect(classifyShopError({ code: '42501', message: 'new row violates' })).toBe('forbidden');
    expect(classifyShopError(new TypeError('Network request failed'))).toBe('network');
    expect(classifyShopError({ code: 'XX000', message: 'boom' })).toBe('unknown');
  });
});
