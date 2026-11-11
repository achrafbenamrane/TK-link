import { fetchMyShop, fileMyShop } from '../lib/shop-api';
import { useMerchantStore } from '../model/store';

/**
 * Le dépôt du dossier et la relecture de son statut, AVEC un serveur : le statut affiché est celui
 * que le serveur renvoie, jamais celui que l'appareil voudrait. Sans serveur, voir `wholesaler.test`.
 */
jest.mock('@/shared/lib/env', () => ({
  ...jest.requireActual('@/shared/lib/env'),
  isSupabaseConfigured: true,
}));
jest.mock('../lib/shop-api', () => ({
  ...jest.requireActual('../lib/shop-api'),
  fetchMyShop: jest.fn(),
  fileMyShop: jest.fn(),
}));

const fetchShop = fetchMyShop as jest.Mock;
const fileShop = fileMyShop as jest.Mock;

const DRAFT = {
  siret: '44306184100047',
  address: '8 rue des Carmes, 31000 Toulouse',
  iban: 'FR76 3000 6000 0112 3456 7890 189',
  idUri: 'file://id.jpg',
};
const SHOP = {
  kind: 'commercant' as const,
  name: 'Le Petit Toulousain',
  category: 'restauration' as const,
  area: 'Toulouse',
  modes: ['touch-collect' as const],
};
const served = (status: string, reviewNote = '') => ({
  ok: true,
  value: { ...SHOP, ...DRAFT, id: 'shop-1', status, reviewNote },
});

const initial = useMerchantStore.getState();
beforeEach(() => {
  useMerchantStore.setState(initial, true);
  jest.clearAllMocks();
});

describe('déposer le dossier auprès de TK LINK', () => {
  it('le dossier part au serveur et prend SON statut', async () => {
    fileShop.mockResolvedValueOnce(served('en_verification'));
    const res = await useMerchantStore.getState().fileShop(DRAFT, SHOP);
    expect(res).toEqual({ ok: true });
    expect(fileShop).toHaveBeenCalledWith({
      ...SHOP,
      siret: DRAFT.siret,
      address: DRAFT.address,
    });
    const { supplier } = useMerchantStore.getState();
    expect(supplier.status).toBe('en_verification');
    // L'IBAN ne part pas au serveur et ne reste pas en clair : seul un repère masqué est gardé.
    expect(fileShop.mock.calls[0][0]).not.toHaveProperty('iban');
    expect(supplier.ibanHint).not.toContain('6000 0112');
  });

  it('un refus du serveur laisse le dossier en brouillon et dit pourquoi', async () => {
    fileShop.mockResolvedValueOnce({ ok: false, code: 'siret_taken' });
    expect(await useMerchantStore.getState().fileShop(DRAFT, SHOP)).toEqual({
      ok: false,
      code: 'siret_taken',
    });
    expect(useMerchantStore.getState().supplier.status).toBe('brouillon');
  });

  it('les pièces manquantes sont signalées avant tout appel au serveur', async () => {
    const res = await useMerchantStore.getState().fileShop({ ...DRAFT, idUri: '' }, SHOP);
    expect(res).toEqual({
      ok: false,
      errors: expect.objectContaining({ idUri: expect.any(String) }),
    });
    expect(fileShop).not.toHaveBeenCalled();
  });

  it('sans nom ni catégorie du commerce sur cet appareil, rien ne part', async () => {
    const res = await useMerchantStore.getState().fileShop(DRAFT, { ...SHOP, name: '' });
    expect(res).toEqual({ ok: false, code: 'incomplete' });
    expect(fileShop).not.toHaveBeenCalled();
  });
});

describe('relire le statut', () => {
  it('validé par TK LINK : la publication s’ouvre', async () => {
    useMerchantStore.setState({ supplier: { ...initial.supplier, status: 'en_verification' } });
    fetchShop.mockResolvedValueOnce(served('valide'));
    await useMerchantStore.getState().refreshShop();
    expect(useMerchantStore.getState().supplier.status).toBe('valide');
  });

  it('refusé : le motif accompagne le statut', async () => {
    fetchShop.mockResolvedValueOnce(served('refuse', 'Le SIRET ne correspond pas à l’adresse.'));
    await useMerchantStore.getState().refreshShop();
    expect(useMerchantStore.getState().supplier).toEqual(
      expect.objectContaining({
        status: 'refuse',
        reviewNote: 'Le SIRET ne correspond pas à l’adresse.',
      }),
    );
  });

  it('un « validé » local sans dossier sur le serveur repart au dépôt', async () => {
    useMerchantStore.setState({ supplier: { ...initial.supplier, status: 'valide' } });
    fetchShop.mockResolvedValueOnce({ ok: true, value: null });
    await useMerchantStore.getState().refreshShop();
    expect(useMerchantStore.getState().supplier.status).toBe('brouillon');
  });

  it('hors ligne, rien ne change', async () => {
    useMerchantStore.setState({ supplier: { ...initial.supplier, status: 'valide' } });
    fetchShop.mockResolvedValueOnce({ ok: false, code: 'network' });
    await useMerchantStore.getState().refreshShop();
    expect(useMerchantStore.getState().supplier.status).toBe('valide');
  });
});
