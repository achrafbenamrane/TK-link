import { Share } from 'react-native';

import { fireEvent, render, screen, waitFor } from '@/shared/testing/render';

import { supabase } from '@/shared/lib/supabase';

import { classifyLoyaltyError, fetchMyLoyalty } from '../lib/loyalty-api';
import { useMerchantLoyaltyStore } from '../model/merchant-store';
import { MerchantLoyaltyScreen } from '../ui/merchant-loyalty-screen';
import { RewardsScreen } from '../ui/rewards-screen';
import { TiersSettingsScreen } from '../ui/tiers-settings-screen';

/**
 * La fidélité d’un commerce du serveur (migration 0017, rapport d’avancement du 13/11/2026) : les
 * points et les récompenses viennent du serveur ; un programme absent n’est pas remplacé par celui
 * de démonstration ; réclamer et valider passent par le serveur. Le serveur est simulé.
 */
const mockServer = { configured: true };
jest.mock('@/shared/lib/env', () =>
  Object.defineProperty({ ...jest.requireActual('@/shared/lib/env') }, 'isSupabaseConfigured', {
    enumerable: true,
    get: () => mockServer.configured,
  }),
);
jest.mock('@/shared/lib/supabase', () => ({
  supabase: { auth: { getSession: jest.fn() }, from: jest.fn(), rpc: jest.fn() },
}));

const from = supabase.from as unknown as jest.Mock;
const rpc = supabase.rpc as unknown as jest.Mock;

const SHOP = '66666666-6666-4666-8666-666666666666';
const TIERS = [
  { rank: 1, cost: 3, reward: '1 café' },
  { rank: 2, cost: 50, reward: '1 brioche' },
];

/** Un faux PostgREST : chaque table rend ses lignes. */
function serve(tables: Record<string, unknown>) {
  from.mockImplementation((table: string) => {
    const data = tables[table] ?? [];
    const chain: Record<string, jest.Mock> & { then?: unknown } = {};
    for (const k of ['select', 'eq', 'in', 'order']) chain[k] = jest.fn(() => chain);
    chain.maybeSingle = jest.fn(async () => ({
      data: Array.isArray(data) ? (data[0] ?? null) : data,
      error: null,
    }));
    chain.then = (resolve: (v: unknown) => void) => resolve({ data, error: null });
    return chain;
  });
}

beforeEach(() => {
  from.mockReset();
  rpc.mockReset();
  mockServer.configured = true;
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({
    data: { session: { user: { id: 'u-1' } } },
  });
  useMerchantLoyaltyStore.setState({ cards: {}, programs: {}, rewards: [] });
});

describe('lecture du serveur', () => {
  it('additionne mes points par commerce, avec les paliers déjà réclamés', async () => {
    serve({
      loyalty_ledger: [
        { id: 'l1', shop_id: SHOP, points: 4, created_at: '2026-11-13T10:00:00Z' },
        { id: 'l2', shop_id: SHOP, points: 9, created_at: '2026-11-13T12:00:00Z' },
      ],
      loyalty_rewards: [
        {
          id: 'r1',
          shop_id: SHOP,
          rank: 1,
          label: '1 café',
          code: 'TK-ABCDEF',
          status: 'disponible',
          created_at: '2026-11-13T12:05:00Z',
        },
      ],
      loyalty_programs: [{ shop_id: SHOP, unit: 'euros', tiers: TIERS }],
    });
    const res = await fetchMyLoyalty();
    expect(res.ok && res.value.cards[SHOP]).toMatchObject({ points: 13, claimed: [1] });
    expect(res.ok && res.value.programs[SHOP]?.tiers).toHaveLength(2);
    expect(res.ok && res.value.rewards[0]).toMatchObject({ code: 'TK-ABCDEF', merchantId: SHOP });
  });

  it('reconnaît les refus du serveur', () => {
    expect(classifyLoyaltyError({ message: 'not_enough_points' })).toBe('not_enough_points');
    expect(classifyLoyaltyError({ message: 'already_claimed' })).toBe('already_claimed');
    expect(classifyLoyaltyError({ message: 'reward_not_shareable' })).toBe('reward_not_shareable');
  });
});

describe('fidélité chez un commerce du serveur', () => {
  it('sans programme enregistré : pas de paliers de démonstration, les points s’accumulent', async () => {
    serve({
      loyalty_ledger: [{ id: 'l1', shop_id: SHOP, points: 4, created_at: '2026-11-13T10:00:00Z' }],
      loyalty_programs: [],
    });
    render(<MerchantLoyaltyScreen merchantId={SHOP} merchantName="Le Petit" onBack={jest.fn()} />);
    expect(await screen.findByTestId('loyalty-no-program')).toBeOnTheScreen();
    expect(screen.queryByTestId('tier-1')).toBeNull();
  });

  it('réclamer passe par le serveur ; un refus est expliqué', async () => {
    serve({
      loyalty_ledger: [{ id: 'l1', shop_id: SHOP, points: 4, created_at: '2026-11-13T10:00:00Z' }],
      loyalty_programs: [{ shop_id: SHOP, unit: 'euros', tiers: TIERS }],
    });
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'already_claimed' } });
    render(<MerchantLoyaltyScreen merchantId={SHOP} merchantName="Le Petit" onBack={jest.fn()} />);

    fireEvent.press(await screen.findByTestId('tier-claim-1'));
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith('claim_reward', { p_shop: SHOP, p_rank: 1 }),
    );
    expect(await screen.findByTestId('loyalty-claim-error')).toHaveTextContent(/déjà débloqué/);
  });
});

describe('le commerçant, avec un serveur', () => {
  it('enregistre ses paliers sur le serveur, et valide un code par le serveur', async () => {
    serve({ shops: [{ id: SHOP }], loyalty_programs: [] });
    rpc.mockResolvedValueOnce({ data: null, error: null });
    render(<TiersSettingsScreen merchantId="local" server />);

    fireEvent.press(screen.getByTestId('tiers-save'));
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith(
        'save_loyalty_program',
        expect.objectContaining({ p_unit: 'euros' }),
      ),
    );

    rpc.mockResolvedValueOnce({ data: { label: '1 café', rank: 1 }, error: null });
    fireEvent.changeText(screen.getByTestId('reward-redeem-code'), 'tk-abcdef');
    fireEvent.press(screen.getByTestId('reward-redeem-submit'));
    expect(await screen.findByTestId('reward-redeem-result')).toHaveTextContent('Validée : 1 café');
    expect(rpc).toHaveBeenLastCalledWith('redeem_reward', { p_code: 'TK-ABCDEF' });
  });
});

describe('partager une récompense d’un commerce du serveur (migration 0018)', () => {
  const reward = (status: string) => ({
    id: '77777777-7777-4777-8777-777777777777',
    shop_id: SHOP,
    rank: 1,
    label: '1 café',
    code: 'TK-ABCDEF',
    status,
    created_at: '2026-11-13T12:05:00Z',
  });

  it('une récompense partagée se relit, et se range dans l’historique', async () => {
    serve({ loyalty_ledger: [], loyalty_rewards: [reward('partagee')], loyalty_programs: [] });
    const res = await fetchMyLoyalty();
    expect(res.ok && res.value.rewards[0]).toMatchObject({ status: 'partagee' });
  });

  it('après le partage, le serveur la marque « partagée » ; elle quitte l’inventaire', async () => {
    serve({ loyalty_ledger: [], loyalty_rewards: [reward('disponible')], loyalty_programs: [] });
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
    rpc.mockResolvedValueOnce({ data: 'TK-ABCDEF', error: null });
    render(<RewardsScreen />);

    fireEvent.press(await screen.findByTestId('reward-share-77777777-7777-4777-8777-777777777777'));
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith('share_reward', {
        p_reward: '77777777-7777-4777-8777-777777777777',
      }),
    );
    expect(share).toHaveBeenCalledWith({ message: expect.stringContaining('TK-ABCDEF') });
    await waitFor(() =>
      expect(useMerchantLoyaltyStore.getState().rewards[0]?.status).toBe('partagee'),
    );
    share.mockRestore();
  });

  it('si le serveur refuse, la récompense reste dans l’inventaire', async () => {
    serve({ loyalty_ledger: [], loyalty_rewards: [reward('disponible')], loyalty_programs: [] });
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'reward_not_shareable' } });
    render(<RewardsScreen />);

    fireEvent.press(await screen.findByTestId('reward-share-77777777-7777-4777-8777-777777777777'));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('share_reward', expect.anything()));
    expect(useMerchantLoyaltyStore.getState().rewards[0]?.status).toBe('disponible');
    share.mockRestore();
  });
});
