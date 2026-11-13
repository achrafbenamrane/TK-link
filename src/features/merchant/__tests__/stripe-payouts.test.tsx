import { render, screen, waitFor } from '@/shared/testing/render';

import { callEdge } from '@/shared/lib/edge';

import { fetchStripePayouts } from '../lib/payments-api';
import { StripePayoutsCard } from '../ui/stripe-payouts-card';

/**
 * L'onglet Versements lu chez Stripe (V1.1, Commerçant > Flux finance) : le solde et les virements du
 * compte connecté. Stripe est simulé ; tant qu'il ne répond pas, la carte ne s'affiche pas.
 */
jest.mock('@/shared/lib/edge', () => ({ callEdge: jest.fn() }));

const edge = callEdge as jest.Mock;

beforeEach(() => edge.mockReset());

it('montre le solde disponible, en attente, et les derniers virements', async () => {
  edge.mockResolvedValue({
    ok: true,
    data: {
      availableCents: 4250,
      pendingCents: 1290,
      payouts: [
        { id: 'po_1', amountCents: 3676, arrivalDate: Date.UTC(2026, 10, 14, 12), status: 'paid' },
      ],
    },
  });
  render(<StripePayoutsCard />);

  expect(await screen.findByTestId('stripe-available')).toHaveTextContent('42,50 €');
  expect(screen.getByTestId('stripe-pending')).toHaveTextContent('12,90 €');
  expect(screen.getByTestId('stripe-payout-po_1')).toHaveTextContent(/14\/11\/2026 · Versé/);
  expect(screen.getByTestId('stripe-payout-po_1')).toHaveTextContent(/36,76 €/);
  expect(edge).toHaveBeenCalledWith('stripe-balance');
});

it('pas encore de virement : la carte le dit', async () => {
  edge.mockResolvedValue({ ok: true, data: { availableCents: 0, pendingCents: 0, payouts: [] } });
  render(<StripePayoutsCard />);
  expect(await screen.findByTestId('stripe-payouts-empty')).toBeTruthy();
});

it('Stripe pas encore branché, ou commerce pas inscrit : rien, l’estimation reste seule', async () => {
  edge.mockResolvedValue({ ok: false, code: 'stripe_not_configured', status: 503 });
  render(<StripePayoutsCard />);
  await waitFor(() => expect(edge).toHaveBeenCalled());
  expect(screen.queryByTestId('stripe-payouts')).toBeNull();

  edge.mockResolvedValue({ ok: false, code: 'not_onboarded', status: 409 });
  expect(await fetchStripePayouts()).toEqual({ ok: false, code: 'not_onboarded' });
});

it('une réponse mal formée n’est pas affichée', async () => {
  edge.mockResolvedValue({ ok: true, data: { availableCents: 'beaucoup' } });
  expect(await fetchStripePayouts()).toEqual({ ok: false, code: 'unknown' });
});
