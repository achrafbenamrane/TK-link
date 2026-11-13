import { createHmac } from 'crypto';

import {
  applicationFeeCents,
  effectOf,
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
