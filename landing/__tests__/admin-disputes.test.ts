/* eslint-disable @typescript-eslint/no-require-imports -- why: le site (landing/) est du JS hors tsconfig */

/**
 * L'onglet Litiges du back-office (migrations 0012 et 0021) : ce qu'une décision fait de la commande,
 * le motif exigé, et la mise en forme des commandes en litige.
 */
const d = require('../app/admin/disputes') as {
  statusAfter: (outcome: string, fulfilment: string) => string | null;
  validNote: (note: unknown) => string | null;
  orderRef: (id: string) => string;
  disputeKind: (order: Record<string, unknown>, ticket?: Record<string, unknown>) => string;
  refundFailureText: (code: unknown) => string | null;
  toDisputes: (
    orders: unknown[],
    shops: unknown[],
    profiles: unknown[],
    tickets: unknown[],
  ) => {
    disputes: {
      id: string;
      kind: string;
      order: string;
      merchant: string;
      customer: string;
      amountCents: number;
      message: string;
      paymentIntent: string | null;
      stripeAccount: string | null;
      chargeback: boolean;
      refundFailure: string | null;
    }[];
    rulings: Record<string, { outcome: string; note: string }>;
  };
};

it('rembourser : remboursement en cours (Stripe le finit) ; sinon la commande est honorée', () => {
  expect(d.statusAfter('refund', 'touch-collect')).toBe('remboursement_en_cours');
  expect(d.statusAfter('merchant', 'touch-collect')).toBe('recuperee');
  expect(d.statusAfter('gesture', 'livraison')).toBe('livree');
  expect(d.statusAfter('autre', 'livraison')).toBeNull();
});

it('une décision est toujours motivée', () => {
  expect(d.validNote('  ok  ')).toBeNull();
  expect(d.validNote('Payé hors délai, stock revendu : remboursé.')).toBe(
    'Payé hors délai, stock revendu : remboursé.',
  );
  expect(d.validNote('x'.repeat(501))).toBeNull();
});

it('le genre de litige vient de la course, puis de la demande au support', () => {
  expect(d.disputeKind({ uber_status: 'returned' })).toBe('livraison');
  expect(d.disputeKind({ uber_status: null }, { category: 'commande' })).toBe('manquant');
  expect(d.disputeKind({ uber_status: null })).toBe('paiement');
});

it('0027 : la contestation bancaire, puis le motif choisi dans l’app, décident du genre', () => {
  expect(d.disputeKind({ stripe_dispute_id: 'dp_1', issue_kind: 'non_conforme' })).toBe('paiement');
  expect(d.disputeKind({ issue_kind: 'non_conforme' })).toBe('manquant');
  expect(d.disputeKind({ issue_kind: 'non_recue', fulfilment: 'livraison' })).toBe('livraison');
  expect(d.disputeKind({ issue_kind: 'non_recue', fulfilment: 'touch-collect' })).toBe(
    'indisponible',
  );
  // « Autre » : la course, puis la demande au support, comme avant.
  expect(d.disputeKind({ issue_kind: 'autre', uber_status: 'returned' })).toBe('livraison');
});

it('0027 : un remboursement automatique qui n’est pas parti se dit en clair', () => {
  expect(d.refundFailureText(null)).toBeNull();
  expect(d.refundFailureText('courier_active')).toMatch(/coursier Uber Direct est encore en route/);
  expect(d.refundFailureText('stripe_failed:insufficient_funds')).toMatch(
    /Stripe a refusé.*\(insufficient_funds\).*À faire dans Stripe/,
  );
  expect(d.refundFailureText('refund_failed:expired_or_canceled_card')).toMatch(
    /n’a pas pu rendre l’argent \(expired_or_canceled_card\)/,
  );
});

it('0027 : la carte d’un litige dit d’où il vient', () => {
  const base = {
    customer_id: 'u1',
    shop_id: 's1',
    fulfilment: 'touch-collect',
    status: 'litige',
    total_cents: 700,
    stripe_payment_intent_id: 'pi_9',
    uber_status: null,
    updated_at: '2026-11-14T18:00:00Z',
  };
  const { disputes } = d.toDisputes(
    [
      { ...base, id: 'o-a', issue_kind: 'non_conforme' },
      { ...base, id: 'o-b', stripe_dispute_id: 'dp_1' },
      { ...base, id: 'o-c', refund_failure: 'no_account' },
    ],
    [],
    [],
    [],
  );
  expect(disputes[0]).toMatchObject({
    kind: 'manquant',
    message: expect.stringMatching(/incomplet ou non conforme/),
    chargeback: false,
    refundFailure: null,
  });
  expect(disputes[1]).toMatchObject({
    kind: 'paiement',
    message: expect.stringMatching(/conteste le paiement auprès de sa banque/),
    chargeback: true,
  });
  expect(disputes[2]?.refundFailure).toMatch(/le commerce n’a pas de compte Stripe/);
});

it('met en forme les commandes en litige, avec le dernier mot du client et le paiement Stripe', () => {
  const ORDER = '22222222-2222-4222-8222-2222224a1b2c';
  const { disputes, rulings } = d.toDisputes(
    [
      {
        id: ORDER,
        customer_id: 'u1',
        shop_id: 's1',
        fulfilment: 'touch-collect',
        status: 'litige',
        total_cents: 700,
        stripe_payment_intent_id: 'pi_123',
        uber_status: null,
        updated_at: '2026-11-13T18:00:00Z',
      },
      {
        id: '33333333-3333-4333-8333-333333333333',
        customer_id: 'u1',
        shop_id: 's1',
        fulfilment: 'livraison',
        status: 'remboursement_en_cours',
        total_cents: 1000,
        stripe_payment_intent_id: 'pi_456',
        uber_status: 'canceled',
        updated_at: '2026-11-13T17:00:00Z',
        dispute_outcome: 'refund',
        dispute_note: 'Course échouée : remboursé.',
        dispute_decided_at: '2026-11-13T17:30:00Z',
      },
    ],
    [{ id: 's1', name: 'Le Petit Toulousain', stripe_account_id: 'acct_1' }],
    [{ id: 'u1', first_name: 'Sofiane', last_name: 'B.' }],
    [
      {
        order_id: ORDER,
        category: 'paiement',
        support_messages: [
          {
            body: 'J’ai payé mais la commande est annulée.',
            from_staff: false,
            created_at: '2026-11-13T18:05:00Z',
          },
          { body: 'Nous regardons.', from_staff: true, created_at: '2026-11-13T18:10:00Z' },
        ],
      },
    ],
  );
  expect(disputes[0]).toMatchObject({
    order: '#TKL-4A1B2C',
    kind: 'paiement',
    merchant: 'Le Petit Toulousain',
    customer: 'Sofiane B.',
    amountCents: 700,
    message: 'J’ai payé mais la commande est annulée.',
    paymentIntent: 'pi_123',
    stripeAccount: 'acct_1',
  });
  expect(disputes[1]?.kind).toBe('livraison');
  expect(disputes[1]?.message).toMatch(/Uber Direct/);
  expect(rulings).toEqual({
    '33333333-3333-4333-8333-333333333333': {
      outcome: 'refund',
      note: 'Course échouée : remboursé.',
    },
  });
});
