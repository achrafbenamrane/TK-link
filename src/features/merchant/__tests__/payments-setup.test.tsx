import { openBrowserAsync } from 'expo-web-browser';

import { fireEvent, render, screen, waitFor } from '@/shared/testing/render';

import { callEdge } from '@/shared/lib/edge';
import { supabase } from '@/shared/lib/supabase';

import { PaymentsSetupCard } from '../ui/payments-setup-card';

/**
 * L’inscription du commerce aux paiements en ligne (Stripe Connect, rapport d’avancement du
 * 13/11/2026). Stripe et le serveur sont simulés.
 */
const mockServer = { configured: true };
jest.mock('@/shared/lib/env', () =>
  Object.defineProperty({ ...jest.requireActual('@/shared/lib/env') }, 'isSupabaseConfigured', {
    enumerable: true,
    get: () => mockServer.configured,
  }),
);
jest.mock('@/shared/lib/edge', () => ({ callEdge: jest.fn() }));
jest.mock('@/shared/lib/supabase', () => ({
  supabase: { auth: { getSession: jest.fn() }, from: jest.fn() },
}));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(async () => ({})) }));

const from = supabase.from as unknown as jest.Mock;
const edge = callEdge as jest.Mock;

function shopRow(row: { stripe_account_id: string | null; stripe_charges_enabled: boolean }) {
  from.mockImplementation(() => {
    const chain: Record<string, jest.Mock> = {};
    chain.select = jest.fn(() => chain);
    chain.eq = jest.fn(() => chain);
    chain.maybeSingle = jest.fn(async () => ({ data: row, error: null }));
    return chain;
  });
}

beforeEach(() => {
  from.mockReset();
  edge.mockReset();
  (openBrowserAsync as jest.Mock).mockClear();
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({
    data: { session: { user: { id: 'u-1' } } },
  });
});

it('pas encore inscrit : « Recevoir mes paiements » ouvre l’inscription Stripe', async () => {
  shopRow({ stripe_account_id: null, stripe_charges_enabled: false });
  edge.mockResolvedValue({ ok: true, data: { url: 'https://connect.stripe.com/setup/e/x' } });
  render(<PaymentsSetupCard />);

  fireEvent.press(await screen.findByTestId('payments-setup-open'));
  await waitFor(() =>
    expect(openBrowserAsync).toHaveBeenCalledWith('https://connect.stripe.com/setup/e/x'),
  );
  expect(edge).toHaveBeenCalledWith('stripe-connect');
});

it('inscription commencée : on la complète', async () => {
  shopRow({ stripe_account_id: 'acct_1', stripe_charges_enabled: false });
  render(<PaymentsSetupCard />);
  expect(await screen.findByTestId('payments-setup-open')).toHaveTextContent(
    /Compléter mon inscription/,
  );
});

it('activé : plus de bouton, le commerçant sait qu’il encaisse', async () => {
  shopRow({ stripe_account_id: 'acct_1', stripe_charges_enabled: true });
  render(<PaymentsSetupCard />);
  expect(await screen.findByTestId('payments-setup-title')).toHaveTextContent(
    'Paiements en ligne activés',
  );
  expect(screen.queryByTestId('payments-setup-open')).toBeNull();
});

it('boutique pas encore validée : le motif est dit', async () => {
  shopRow({ stripe_account_id: null, stripe_charges_enabled: false });
  edge.mockResolvedValue({ ok: false, code: 'shop_not_validated', status: 409 });
  render(<PaymentsSetupCard />);
  fireEvent.press(await screen.findByTestId('payments-setup-open'));
  expect(await screen.findByTestId('payments-setup-error')).toHaveTextContent(
    'Votre boutique doit d’abord être validée par TK LINK.',
  );
  expect(openBrowserAsync).not.toHaveBeenCalled();
});
