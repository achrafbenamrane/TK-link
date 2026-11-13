import { createHmac } from 'crypto';

import {
  afterExpire,
  applicationFeeCents,
  checkoutParams,
  checkoutTotal,
  effectOf,
  nextCheckoutStep,
  parseBalance,
  parsePayouts,
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
    returnUrl: 'https://tklink.vercel.app/stripe/paiement',
    nowS: 1_763_050_000,
  };

  it('détaille les articles et la livraison, pour exactement le total de la commande', () => {
    const params = checkoutParams(base);
    expect(checkoutTotal(params)).toBe(999);
    expect(params).toMatchObject({
      mode: 'payment',
      payment_intent_data: { application_fee_amount: 619, metadata: { order_id: 'o-1' } },
      success_url: 'https://tklink.vercel.app/stripe/paiement?commande=o-1&etat=ok',
      cancel_url: 'https://tklink.vercel.app/stripe/paiement?commande=o-1&etat=annule',
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
      returnUrl: 'https://tklink.vercel.app/stripe/paiement',
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
      returnUrl: 'https://tklink.vercel.app/stripe/paiement',
      nowS: 1763078400,
    });
    expect(params.payment_method_types).toEqual(['card']);
  });
});
