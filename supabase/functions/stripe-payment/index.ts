// Prépare le paiement d'une commande réservée — appelé par l'ACHETEUR, juste avant la feuille de
// paiement Stripe (PaymentSheet) dans l'app. Rend le secret du paiement et le compte du commerçant.
//
// CDC V1.1 : « Direct charges ». Le paiement est créé AU NOM du commerçant (`Stripe-Account`) ;
// TK LINK prélève ses frais d'application (commission + livraison − réduction qu'il offre). Le
// montant vient de la commande, calculée par le serveur (`reserve_flash`, `uber-quote`) — jamais du
// téléphone. Le webhook Stripe passe ensuite la commande à « payée » (`stripe-webhook`).
//
// Rejouable : une commande n'a qu'un paiement (clé d'idempotence + identifiant gardé sur la ligne).
import { adminClient, callerOf, CORS, jsonBody, reply, UUID } from '../_shared/http.ts';
import { applicationFeeCents } from '../_shared/stripe.ts';
import { stripeConfigured, stripeRequest } from '../_shared/stripe-api.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
  if (!stripeConfigured()) return reply(503, { error: 'stripe_not_configured' });

  const user = await callerOf(req);
  if (!user) return reply(401, { error: 'unauthorized' });

  const orderId = (await jsonBody(req))?.orderId;
  if (typeof orderId !== 'string' || !UUID.test(orderId))
    return reply(400, { error: 'invalid_order' });

  const admin = adminClient();
  const { data: order } = await admin
    .from('flash_orders')
    .select(
      'id, customer_id, shop_id, fulfilment, status, reserved_until, subtotal_cents, discount_cents, delivery_fee_cents, total_cents, commission_cents, uber_quote_id, stripe_payment_intent_id',
    )
    .eq('id', orderId)
    .maybeSingle();
  if (!order || order.customer_id !== user.id) return reply(404, { error: 'order_not_found' });
  if (order.status !== 'paiement_attente') return reply(409, { error: 'order_locked' });
  if (Date.parse(order.reserved_until) < Date.now())
    return reply(410, { error: 'reservation_expired' });
  // Une livraison se paie avec ses frais : le devis Uber doit être fait.
  if (order.fulfilment === 'livraison' && !order.uber_quote_id) {
    return reply(409, { error: 'delivery_quote_required' });
  }

  const { data: shop } = await admin
    .from('shops')
    .select('stripe_account_id, stripe_charges_enabled, name')
    .eq('id', order.shop_id)
    .maybeSingle();
  if (!shop?.stripe_account_id || !shop.stripe_charges_enabled) {
    return reply(409, { error: 'shop_cannot_be_paid' });
  }

  const fee = applicationFeeCents(order);
  if (fee === null) return reply(409, { error: 'discount_too_large' });

  const intent = await stripeRequest(
    'POST',
    'payment_intents',
    {
      amount: order.total_cents,
      currency: 'eur',
      application_fee_amount: fee,
      automatic_payment_methods: { enabled: true },
      description: `TK LINK — ${shop.name}`,
      metadata: { order_id: order.id },
    },
    // Même commande, même paiement : un second appel rend le paiement déjà créé.
    {
      account: shop.stripe_account_id,
      idempotencyKey: `tklink-order-${order.id}-${order.total_cents}`,
    },
  );
  const id = intent.body?.id;
  const secret = intent.body?.client_secret;
  if (intent.status >= 300 || typeof id !== 'string' || typeof secret !== 'string') {
    return reply(502, { error: 'stripe_failed' });
  }

  // Le paiement est lancé : la réservation tient le temps de le finir (le webhook peut tarder).
  const { error } = await admin
    .from('flash_orders')
    .update({
      stripe_payment_intent_id: id,
      reserved_until: new Date(Date.now() + 15 * 60_000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id)
    .eq('status', 'paiement_attente');
  if (error) return reply(500, { error: 'server_error' });

  return reply(200, {
    clientSecret: secret,
    stripeAccountId: shop.stripe_account_id,
    totalCents: order.total_cents,
  });
});
