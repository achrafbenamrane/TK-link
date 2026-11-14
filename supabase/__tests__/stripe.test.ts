import { createHmac } from 'crypto';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

import {
  afterExpire,
  afterRefund,
  applicationFeeCents,
  checkoutParams,
  checkoutTotal,
  effectOf,
  nextCheckoutStep,
  parseBalance,
  parsePayouts,
  refundPlan,
  returnUrlOf,
  stripeForm,
  verifyStripeSignature,
} from '../functions/_shared/stripe';

/**
 * Stripe Connect en « Direct charges » (CDC V1.1). Ce qui se teste sans compte Stripe : les montants,
 * l'encodage, la signature des webhooks, l'effet d'un événement.
 */
describe('ce que TK LINK prélève', () => {
  const order = (o: Partial<Parameters<typeof applicationFeeCents>[0]>) => {
    const base = {
      subtotal_cents: 2000,
      discount_cents: 0,
      delivery_fee_cents: 0,
      commission_cents: 100,
      ...o,
    };
    return {
      ...base,
      total_cents: base.subtotal_cents - base.discount_cents + base.delivery_fee_cents,
    };
  };

  it('Touch & Collect : la commission seule ; le commerçant touche le prix moins 5 %', () => {
    const o = order({});
    expect(applicationFeeCents(o)).toBe(100);
    expect(o.total_cents - applicationFeeCents(o)!).toBe(1900);
  });

  it('livraison : TK LINK garde aussi les frais de livraison (il paie Uber Direct)', () => {
    const o = order({ delivery_fee_cents: 599 });
    expect(applicationFeeCents(o)).toBe(699);
    expect(o.total_cents - applicationFeeCents(o)!).toBe(1900);
  });

  it('une réduction offerte par TK LINK ne coûte rien au commerçant', () => {
    const o = order({ delivery_fee_cents: 599, discount_cents: 500 });
    expect(applicationFeeCents(o)).toBe(199);
    expect(o.total_cents - applicationFeeCents(o)!).toBe(1900);
  });

  it('une réduction plus grande que le prélèvement ne se paie pas en Direct charges', () => {
    expect(applicationFeeCents(order({ discount_cents: 500 }))).toBeNull();
  });
});

describe('encodage des requêtes', () => {
  it('aplatit les objets à la façon de Stripe', () => {
    expect(
      stripeForm({
        amount: 1900,
        currency: 'eur',
        automatic_payment_methods: { enabled: true },
        metadata: { order_id: 'abc' },
        skip: undefined,
      }),
    ).toBe(
      'amount=1900&currency=eur&automatic_payment_methods%5Benabled%5D=true&metadata%5Border_id%5D=abc',
    );
  });

  it('encode les listes avec leur indice', () => {
    expect(stripeForm({ expand: ['a', 'b'] })).toBe('expand%5B0%5D=a&expand%5B1%5D=b');
  });
});

describe('signature des webhooks', () => {
  const secret = 'whsec_test';
  const body = '{"type":"payment_intent.succeeded"}';
  const t = 1_763_050_000;
  const sig = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');

  it('accepte une signature récente et juste', async () => {
    expect(await verifyStripeSignature(body, `t=${t},v1=${sig}`, secret, t + 10)).toBe(true);
    // Plusieurs v1 (rotation du secret) : une seule doit correspondre.
    expect(await verifyStripeSignature(body, `t=${t},v1=deadbeef,v1=${sig}`, secret, t)).toBe(true);
  });

  it('refuse un rejeu ancien, un corps modifié, un autre secret', async () => {
    expect(await verifyStripeSignature(body, `t=${t},v1=${sig}`, secret, t + 3600)).toBe(false);
    expect(await verifyStripeSignature(`${body} `, `t=${t},v1=${sig}`, secret, t)).toBe(false);
    expect(await verifyStripeSignature(body, `t=${t},v1=${sig}`, 'whsec_autre', t)).toBe(false);
    expect(await verifyStripeSignature(body, null, secret, t)).toBe(false);
  });
});

describe('effet d’un événement', () => {
  it('paiement réussi → la commande est payée', () => {
    expect(
      effectOf({
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_1', metadata: { order_id: 'o-1' } } },
      }),
    ).toEqual({ kind: 'order_paid', paymentIntentId: 'pi_1', orderId: 'o-1' });
  });

  it('remboursement total seulement', () => {
    expect(
      effectOf({
        type: 'charge.refunded',
        data: { object: { payment_intent: 'pi_1', refunded: true } },
      }),
    ).toEqual({ kind: 'order_refunded', paymentIntentId: 'pi_1' });
    expect(
      effectOf({
        type: 'charge.refunded',
        data: { object: { payment_intent: 'pi_1', refunded: false } },
      }),
    ).toBeNull();
  });

  it('compte du commerçant activé', () => {
    expect(
      effectOf({
        type: 'account.updated',
        data: { object: { id: 'acct_1', charges_enabled: true } },
      }),
    ).toEqual({ kind: 'account_updated', accountId: 'acct_1', chargesEnabled: true });
  });

  it('les autres événements ne changent rien', () => {
    expect(effectOf({ type: 'customer.created', data: { object: { id: 'cus_1' } } })).toBeNull();
    expect(effectOf(null)).toBeNull();
  });

  it('un remboursement qui échoue après coup (0027), sous ses différents noms', () => {
    for (const type of ['charge.refund.updated', 'refund.updated', 'refund.failed']) {
      expect(
        effectOf({
          type,
          data: {
            object: {
              payment_intent: 'pi_1',
              status: 'failed',
              failure_reason: 'expired_or_canceled_card',
            },
          },
        }),
      ).toEqual({
        kind: 'refund_failed',
        paymentIntentId: 'pi_1',
        reason: 'refund_failed:expired_or_canceled_card',
      });
    }
    // Une mise à jour qui n'est pas un échec ne change rien.
    expect(
      effectOf({
        type: 'refund.updated',
        data: { object: { payment_intent: 'pi_1', status: 'succeeded' } },
      }),
    ).toBeNull();
  });

  it('une contestation bancaire (0027)', () => {
    expect(
      effectOf({
        type: 'charge.dispute.created',
        data: { object: { id: 'dp_1', payment_intent: 'pi_1' } },
      }),
    ).toEqual({ kind: 'order_disputed', paymentIntentId: 'pi_1', disputeId: 'dp_1' });
    expect(
      effectOf({ type: 'charge.dispute.created', data: { object: { id: 'dp_1' } } }),
    ).toBeNull();
  });
});

describe('rembourser une commande (0027, order-refund)', () => {
  const order = (o: Partial<Parameters<typeof refundPlan>[0]> = {}) => ({
    id: 'o-1',
    status: 'remboursement_en_cours',
    stripe_payment_intent_id: 'pi_1',
    uber_delivery_id: null,
    uber_status: null,
    ...o,
  });

  it('le remboursement total, au nom du commerce, frais de TK LINK compris, une seule fois', () => {
    const plan = refundPlan(order(), 'acct_1', true);
    expect(plan).toEqual({
      kind: 'refund',
      account: 'acct_1',
      idempotencyKey: 'tklink-refund-o-1',
      params: {
        payment_intent: 'pi_1',
        refund_application_fee: true,
        reason: 'requested_by_customer',
        metadata: { order_id: 'o-1' },
      },
    });
    // Pas de montant : Stripe rembourse tout ce qui reste.
    expect(plan.kind === 'refund' && 'amount' in plan.params).toBe(false);
    expect(plan.kind === 'refund' && stripeForm(plan.params)).toBe(
      'payment_intent=pi_1&refund_application_fee=true&reason=requested_by_customer&metadata%5Border_id%5D=o-1',
    );
  });

  it('une clé d’idempotence par tentative : une nouvelle décision peut réessayer', () => {
    const first = refundPlan(order({ updated_at: '2026-11-14T18:00:00Z' }), 'acct_1', true);
    const again = refundPlan(order({ updated_at: '2026-11-15T09:30:00Z' }), 'acct_1', true);
    expect(first.kind === 'refund' && first.idempotencyKey).toBe(
      `tklink-refund-o-1-${Date.parse('2026-11-14T18:00:00Z')}`,
    );
    expect(again.kind === 'refund' && again.idempotencyKey).not.toBe(
      first.kind === 'refund' && first.idempotencyKey,
    );
  });

  it('une commande refusée par le commerce se rembourse de la même façon', () => {
    expect(refundPlan(order({ status: 'refusee' }), 'acct_1', true).kind).toBe('refund');
  });

  it('une commande qui n’attend plus son remboursement : rien', () => {
    expect(refundPlan(order({ status: 'remboursee' }), 'acct_1', true)).toEqual({ kind: 'skip' });
    expect(refundPlan(order({ status: 'litige' }), 'acct_1', true)).toEqual({ kind: 'skip' });
  });

  it('ce qui empêche de rembourser seul renvoie au back-office', () => {
    expect(refundPlan(order(), 'acct_1', false)).toEqual({
      kind: 'manual',
      reason: 'stripe_not_configured',
    });
    expect(refundPlan(order({ stripe_payment_intent_id: null }), 'acct_1', true)).toEqual({
      kind: 'manual',
      reason: 'no_payment',
    });
    expect(refundPlan(order(), null, true)).toEqual({ kind: 'manual', reason: 'no_account' });
  });

  it('un coursier en route : on ne rembourse pas une commande qui roule encore', () => {
    for (const uber_status of ['pending', 'pickup', 'pickup_complete', 'dropoff', null]) {
      expect(refundPlan(order({ uber_delivery_id: 'del_1', uber_status }), 'acct_1', true)).toEqual(
        {
          kind: 'manual',
          reason: 'courier_active',
        },
      );
    }
    for (const uber_status of ['canceled', 'returned', 'delivered']) {
      expect(
        refundPlan(order({ uber_delivery_id: 'del_1', uber_status }), 'acct_1', true).kind,
      ).toBe('refund');
    }
  });

  it('la réponse de Stripe → le statut de la commande', () => {
    expect(afterRefund(200, { id: 're_1', status: 'succeeded' })).toEqual({
      status: 'remboursee',
      refundId: 're_1',
      failure: null,
    });
    // En route : le statut ne bouge pas (le réécrire relancerait le déclencheur).
    expect(afterRefund(200, { id: 're_1', status: 'pending' })).toEqual({
      status: null,
      refundId: 're_1',
      failure: null,
    });
    expect(afterRefund(200, { id: 're_1', status: 'failed' })).toEqual({
      status: 'litige',
      refundId: 're_1',
      failure: 'refund_failed',
    });
    // Déjà remboursée chez Stripe (à la main) : c'est fait.
    expect(afterRefund(400, { error: { code: 'charge_already_refunded' } })).toEqual({
      status: 'remboursee',
      refundId: null,
      failure: null,
    });
    expect(afterRefund(402, { error: { code: 'insufficient_funds' } })).toEqual({
      status: 'litige',
      refundId: null,
      failure: 'stripe_failed:insufficient_funds',
    });
    // Stripe injoignable.
    expect(afterRefund(0, null)).toEqual({
      status: 'litige',
      refundId: null,
      failure: 'stripe_failed:unreachable',
    });
  });
});

describe('page de paiement Stripe Checkout', () => {
  const order = {
    id: 'o-1',
    subtotal_cents: 400,
    discount_cents: 0,
    delivery_fee_cents: 599,
    total_cents: 999,
    commission_cents: 20,
  };
  const items = [{ title: 'Brioche', qty: 2, unit_price_cents: 200 }];
  const base = {
    order,
    items,
    shopName: 'Le Petit Toulousain',
    fee: 619,
    returnUrl: 'https://tklink-wine.vercel.app/stripe/paiement',
    nowS: 1_763_050_000,
  };

  it('détaille les articles et la livraison, pour exactement le total de la commande', () => {
    const params = checkoutParams(base);
    expect(checkoutTotal(params)).toBe(999);
    expect(params).toMatchObject({
      mode: 'payment',
      payment_intent_data: { application_fee_amount: 619, metadata: { order_id: 'o-1' } },
      success_url: 'https://tklink-wine.vercel.app/stripe/paiement?commande=o-1&etat=ok',
      cancel_url: 'https://tklink-wine.vercel.app/stripe/paiement?commande=o-1&etat=annule',
      expires_at: 1_763_050_000 + 1800,
    });
  });

  it('une réduction offerte par TK LINK : une seule ligne au total (pas de ligne négative)', () => {
    const discounted = { ...order, discount_cents: 300, total_cents: 699 };
    const params = checkoutParams({ ...base, order: discounted, fee: 319 });
    expect(checkoutTotal(params)).toBe(699);
    expect((params.line_items as unknown[]).length).toBe(1);
  });

  it('s’encode à la façon de Stripe, lignes comprises', () => {
    const form = decodeURIComponent(stripeForm(checkoutParams(base)));
    expect(form).toContain('line_items[0][price_data][unit_amount]=200');
    expect(form).toContain('line_items[0][quantity]=2');
    expect(form).toContain('line_items[1][price_data][product_data][name]=Livraison Uber Direct');
    expect(form).toContain('payment_intent_data[application_fee_amount]=619');
  });
});

describe('les versements d’un commerce, lus chez Stripe', () => {
  it('le solde : l’euro seul, disponible et en attente', () => {
    expect(
      parseBalance({
        available: [
          { amount: 4250, currency: 'eur' },
          { amount: 900, currency: 'usd' },
        ],
        pending: [{ amount: 1290, currency: 'eur' }],
      }),
    ).toEqual({ availableCents: 4250, pendingCents: 1290 });
    expect(parseBalance({ error: { message: 'nope' } })).toBeNull();
    expect(parseBalance(null)).toBeNull();
  });

  it('les virements : en euros, datés, avec un statut connu', () => {
    const payouts = parsePayouts({
      data: [
        { id: 'po_1', amount: 3676, arrival_date: 1763078400, status: 'paid', currency: 'eur' },
        {
          id: 'po_2',
          amount: 500,
          arrival_date: 1763164800,
          status: 'in_transit',
          currency: 'eur',
        },
        { id: 'po_3', amount: 100, arrival_date: 1763164800, status: 'paid', currency: 'usd' },
        { id: 'po_4', amount: 100, arrival_date: 1763164800, status: 'bizarre', currency: 'eur' },
        { amount: 100 },
      ],
    });
    expect(payouts).toEqual([
      { id: 'po_1', amountCents: 3676, arrivalDate: 1763078400000, status: 'paid' },
      { id: 'po_2', amountCents: 500, arrivalDate: 1763164800000, status: 'in_transit' },
    ]);
    expect(parsePayouts({})).toEqual([]);
  });
});

describe('un crédit de parrainage égal à la commission (migration 0019)', () => {
  it('Touch & Collect : TK LINK ne prélève rien, et la page n’envoie pas de frais', () => {
    const order = {
      id: 'o-1',
      subtotal_cents: 700,
      commission_cents: 35,
      discount_cents: 35,
      delivery_fee_cents: 0,
      total_cents: 665,
    };
    const fee = applicationFeeCents(order);
    expect(fee).toBe(0);
    const params = checkoutParams({
      order,
      items: [{ title: 'Pain de campagne', unit_price_cents: 700, qty: 1 }],
      shopName: 'Le Petit',
      fee: fee as number,
      returnUrl: 'https://tklink-wine.vercel.app/stripe/paiement',
      nowS: 1763078400,
    });
    expect(params.payment_intent_data).not.toHaveProperty('application_fee_amount');
    // Une seule ligne, au total du serveur : 6,65 €.
    expect(checkoutTotal(params)).toBe(665);
  });
});

describe('pages de paiement déjà ouvertes (relecture du 13/11/2026)', () => {
  it('redemander une page : rendre l’ouverte, jamais une seconde pour une page payée', () => {
    expect(nextCheckoutStep('open')).toBe('reuse');
    expect(nextCheckoutStep('complete')).toBe('already_paid');
    expect(nextCheckoutStep('expired')).toBe('new');
    expect(nextCheckoutStep(undefined)).toBe('stripe_failed');
  });

  it('après « expirer la page » : annuler seulement si plus personne ne peut y payer', () => {
    expect(afterExpire(200, null)).toBe('cancel');
    expect(afterExpire(400, 'expired')).toBe('cancel');
    expect(afterExpire(400, 'complete')).toBe('already_paid');
    expect(afterExpire(400, 'open')).toBe('stripe_failed');
    expect(afterExpire(0, null)).toBe('stripe_failed');
  });

  it('la page n’accepte que la carte (Apple Pay et Google Pay compris)', () => {
    const params = checkoutParams({
      order: {
        id: 'o-1',
        subtotal_cents: 700,
        commission_cents: 35,
        discount_cents: 0,
        delivery_fee_cents: 0,
        total_cents: 700,
      },
      items: [{ title: 'Quiche', unit_price_cents: 700, qty: 1 }],
      shopName: 'Le Petit',
      fee: 35,
      returnUrl: 'https://tklink-wine.vercel.app/stripe/paiement',
      nowS: 1763078400,
    });
    expect(params.payment_method_types).toEqual(['card']);
  });
});

describe('pages de retour Stripe (relecture du 14/11/2026)', () => {
  it('une adresse https explicite, sinon « non configurée »', () => {
    expect(returnUrlOf('https://tklink-wine.vercel.app/stripe/paiement')).toBe(
      'https://tklink-wine.vercel.app/stripe/paiement',
    );
    expect(returnUrlOf('  https://tklink-wine.vercel.app/stripe/retour ')).toBe(
      'https://tklink-wine.vercel.app/stripe/retour',
    );
    for (const bad of [
      undefined,
      null,
      '',
      '   ',
      'http://tklink-wine.vercel.app/stripe/paiement',
    ]) {
      expect(returnUrlOf(bad)).toBeNull();
    }
    // La page de paiement reçoit ?commande=…&etat=… : une adresse qui a déjà sa requête est refusée.
    expect(returnUrlOf('https://tklink-wine.vercel.app/stripe/paiement?x=1')).toBeNull();
    expect(returnUrlOf('pas une adresse')).toBeNull();
  });

  it('aucune fonction ne renvoie vers tklink.vercel.app (un autre site que TK LINK)', () => {
    const root = join(__dirname, '..', 'functions');
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? files(path) : [path];
      });
    const offenders = files(root).filter((f) =>
      /\/\/tklink\.vercel\.app/.test(readFileSync(f, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
