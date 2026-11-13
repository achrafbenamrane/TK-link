import { fireEvent, render, screen, waitFor } from '@/shared/testing/render';

import { supabase } from '@/shared/lib/supabase';

import { classifyReferralError } from '../lib/referral-api';
import { useReferralStore } from '../model/store';
import { ReferralScreen } from '../ui/referral-screen';

/**
 * Le parrainage sur le serveur (migration 0019) : le code, le parrain, le crédit et les filleuls
 * viennent du serveur ; sans la migration, l'écran garde le parrainage local. Le serveur est simulé.
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

const rpc = supabase.rpc as unknown as jest.Mock;

const summary = (o: Record<string, unknown> = {}) => ({
  code: 'TK-SRV234',
  referrer_code: null,
  unlocked: false,
  balance_cents: 0,
  credit_cents: 500,
  invited: 0,
  invited_unlocked: 0,
  ...o,
});

beforeEach(() => {
  rpc.mockReset();
  mockServer.configured = true;
  useReferralStore.setState({
    myCode: 'TK-LOC234',
    referredBy: null,
    credit: 'aucun',
    server: null,
  });
});

it('montre le code du serveur, mon crédit et mes filleuls', async () => {
  rpc.mockResolvedValue({
    data: summary({ balance_cents: 465, invited: 2, invited_unlocked: 1 }),
    error: null,
  });
  render(<ReferralScreen hasOrdered={false} />);

  expect(await screen.findByText('TK-SRV234')).toBeTruthy();
  expect(screen.getByTestId('referral-balance-amount')).toHaveTextContent('4,65 €');
  expect(screen.getByTestId('referral-invited')).toHaveTextContent(
    '2 proches invités · 1 premier achat',
  );
  expect(rpc).toHaveBeenCalledWith('referral_summary');
});

it('sans la migration 0019, l’écran garde le parrainage local', async () => {
  rpc.mockResolvedValue({
    data: null,
    error: { code: 'PGRST202', message: 'Could not find the function' },
  });
  render(<ReferralScreen hasOrdered={false} />);

  await waitFor(() => expect(rpc).toHaveBeenCalledWith('referral_summary'));
  expect(screen.getByTestId('referral-code')).toHaveTextContent('TK-LOC234');
  expect(useReferralStore.getState().server).toBeNull();
});

it('le serveur juge le code saisi, et l’écran explique un refus', async () => {
  rpc.mockImplementation(async (fn: string) =>
    fn === 'referral_summary'
      ? { data: summary(), error: null }
      : { data: null, error: { message: 'already_customer' } },
  );
  render(<ReferralScreen hasOrdered={false} />);
  await screen.findByText('TK-SRV234');

  fireEvent.changeText(screen.getByTestId('referral-input'), 'tk-abc234');
  fireEvent.press(screen.getByTestId('referral-apply'));

  expect(await screen.findByTestId('referral-error')).toHaveTextContent(/nouveaux clients/);
  expect(rpc).toHaveBeenCalledWith('apply_referral_code', { p_code: 'TK-ABC234' });
});

it('un code accepté : l’écran relit le serveur et montre le parrain', async () => {
  let applied = false;
  rpc.mockImplementation(async (fn: string) => {
    if (fn === 'apply_referral_code') {
      applied = true;
      return { data: null, error: null };
    }
    return { data: summary(applied ? { referrer_code: 'TK-PAR234' } : {}), error: null };
  });
  render(<ReferralScreen hasOrdered={false} />);
  await screen.findByText('TK-SRV234');

  fireEvent.changeText(screen.getByTestId('referral-input'), 'TK-PAR234');
  fireEvent.press(screen.getByTestId('referral-apply'));

  expect(await screen.findByTestId('referral-status')).toHaveTextContent(/Parrain : TK-PAR234/);
  expect(screen.getByTestId('referral-status')).toHaveTextContent(/récupérée ou livrée/);
});

it('reconnaît les refus du serveur', () => {
  expect(classifyReferralError({ message: 'own_code' })).toBe('own_code');
  expect(classifyReferralError({ message: 'already_referred' })).toBe('already_referred');
  expect(classifyReferralError({ code: 'PGRST202', message: 'x' })).toBe('unavailable');
  expect(classifyReferralError(new TypeError('Network request failed'))).toBe('network');
});
