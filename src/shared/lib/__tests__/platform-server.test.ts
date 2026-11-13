import { supabase } from '../supabase';
import {
  currentSettings,
  fromServer,
  mergeSettings,
  usePlatformOverrides,
} from '../platform-overrides';
import { PLATFORM_SETTINGS } from '../platform-settings';
import { loadServerSettings } from '../platform-server';

/**
 * La commission et le crédit de parrainage que le serveur applique (migration 0022) : réglés dans le
 * back-office, relus par l'app pour que le panier estime ce que le serveur calculera. Sans réponse
 * lisible, les valeurs du CDC restent. Le serveur est simulé.
 */
const mockServer = { configured: true };
jest.mock('../env', () =>
  Object.defineProperty({ ...jest.requireActual('../env') }, 'isSupabaseConfigured', {
    enumerable: true,
    get: () => mockServer.configured,
  }),
);
jest.mock('../supabase', () => ({ supabase: { rpc: jest.fn() } }));

const rpc = supabase.rpc as unknown as jest.Mock;

beforeEach(() => {
  rpc.mockReset();
  mockServer.configured = true;
  usePlatformOverrides.setState({ overrides: {}, server: {} });
});

describe('fromServer', () => {
  it('traduit les points de base et les centimes en % et en €', () => {
    expect(fromServer({ commission_bps: 750, referral_credit_cents: 300 })).toEqual({
      commissionB2cPct: 7.5,
      referralRewardEur: 3,
    });
  });

  it('ignore ce qui est absent, et une réponse hors des bornes du serveur', () => {
    expect(fromServer({ commission_bps: null, referral_credit_cents: 500 })).toEqual({
      referralRewardEur: 5,
    });
    expect(fromServer({ commission_bps: 9000 })).toEqual({});
    expect(fromServer({ commission_bps: 'cinq' })).toEqual({});
    expect(fromServer(null)).toEqual({});
  });
});

describe('mergeSettings', () => {
  it('pose le serveur par-dessus le CDC, sans toucher au reste', () => {
    const merged = mergeSettings({}, { commissionB2cPct: 8 });
    expect(merged.commissionB2cPct).toBe(8);
    expect(merged.referralRewardEur).toBe(PLATFORM_SETTINGS.referralRewardEur);
    expect(merged.freeOperations).toBe(PLATFORM_SETTINGS.freeOperations);
  });
});

describe('loadServerSettings', () => {
  it('applique ce que le serveur répond, partout où l’app lit ses réglages', async () => {
    rpc.mockResolvedValue({
      data: { commission_bps: 600, referral_credit_cents: 400 },
      error: null,
    });
    await loadServerSettings();
    expect(rpc).toHaveBeenCalledWith('platform_public_settings');
    expect(currentSettings().commissionB2cPct).toBe(6);
    expect(currentSettings().referralRewardEur).toBe(4);
  });

  it('garde les valeurs du CDC sans la migration 0022 (fonction introuvable)', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'not found' } });
    await loadServerSettings();
    expect(currentSettings().commissionB2cPct).toBe(PLATFORM_SETTINGS.commissionB2cPct);
  });

  it('garde la dernière valeur connue hors ligne', async () => {
    usePlatformOverrides.setState({ server: { commissionB2cPct: 6 } });
    rpc.mockRejectedValue(new Error('Network request failed'));
    await loadServerSettings();
    expect(currentSettings().commissionB2cPct).toBe(6);
  });

  it('ne demande rien en démonstration (pas de serveur)', async () => {
    mockServer.configured = false;
    await loadServerSettings();
    expect(rpc).not.toHaveBeenCalled();
  });
});
