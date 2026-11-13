// Ouvre la page de paiement Stripe Checkout d'une commande réservée — appelé par l'ACHETEUR. Rend
// l'adresse de la page, que l'app ouvre dans un navigateur sécurisé (carte, Apple Pay, Google Pay).
//
// Pourquoi Checkout plutôt que la feuille de paiement native : aucun module natif, donc le paiement
// part par mise à jour OTA, sans nouvelle APK (décision du 13/11/2026). Même Stripe Connect.
//
// CDC V1.1 : « Direct charges ». La page est créée AU NOM du commerçant (`Stripe-Account`) ; TK LINK
// prélève ses frais d'application (commission + livraison − réduction qu'il offre). Les montants
// viennent de la commande, calculée par le serveur (`reserve_flash`, `uber-quote`) — jamais du
// téléphone. Le webhook Stripe passe ensuite la commande à « payée » (`stripe-webhook`).
//
// Rejouable : tant que la page d'une commande est ouverte, on la rend ; sinon on en crée une autre.
import { adminClient, callerOf, CORS, jsonBody, reply, UUID } from '../_shared/http.ts';
import {
  applicationFeeCents,
  checkoutParams,
  checkoutTotal,
  nextCheckoutStep,
} from '../_shared/stripe.ts';
import { stripeConfigured, stripeRequest } from '../_shared/stripe-api.ts';

// Où Stripe renvoie après paiement ou abandon (page du site qui rouvre l'app).
const RETURN_URL =
  Deno.env.get('STRIPE_PAYMENT_RETURN_URL') ?? 'https://tklink.vercel.app/stripe/paiement';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
  if (!stripeConfigured()) return reply(503, { error: 'stripe_not_configured' });

  const user = await callerOf(req);
  if (!user) return reply(401, { error: 'unauthorized' });

  const orderId = (await jsonBody(req))?.orderId;
  if (typeof orderId !== 'string' || !UUID.test(orderId)) {
    return reply(400, { error: 'invalid_order' });
  }

  const admin = adminClient();
  const { data: order } = await admin
    .from('flash_orders')
    .select(
      'id, customer_id, shop_id, fulfilment, status, reserved_until, subtotal_cents, discount_cents, delivery_fee_cents, total_cents, commission_cents, uber_quote_id, stripe_checkout_id',
    )
    .eq('id', orderId)
    .maybeSingle();
  if (!order || order.customer_id !== user.id) return reply(404, { error: 'order_not_found' });
  if (order.status !== 'paiement_attente') return reply(409, { error: 'order_locked' });
  if (Date.parse(order.reserved_until) < Date.now()) {
    return reply(410, { error: 'reservation_expired' });
  }
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

  // Une page déjà ouverte pour cette commande : la rendre (second appui, retour dans l'app). Payée à
  // l'instant (webhook pas encore arrivé) : surtout pas une seconde page. Expirée : en ouvrir une.
  const previous = (order.stripe_checkout_id as string | null) ?? null;
  if (previous) {
    const existing = await stripeRequest(
      'GET',
      `checkout/sessions/${encodeURIComponent(previous)}`,
      {},
      { account: shop.stripe_account_id },
    ).catch(() => ({ status: 0, body: null }));
    const step = nextCheckoutStep(existing.body?.status);
    if (step === 'reuse' && typeof existing.body?.url === 'string') {
      return reply(200, { url: existing.body.url, totalCents: order.total_cents });
    }
    if (step === 'already_paid') return reply(409, { error: 'already_paid' });
    if (step !== 'new') return reply(502, { error: 'stripe_failed' });
  }

  const fee = applicationFeeCents(order);
  if (fee === null) return reply(409, { error: 'discount_too_large' });

  const { data: items } = await admin
    .from('flash_order_items')
    .select('title, qty, unit_price_cents')
    .eq('order_id', order.id);

  const params = checkoutParams({
    order,
    items: items ?? [],
    shopName: shop.name,
    fee,
    returnUrl: RETURN_URL,
    email: user.email ?? null,
    nowS: Math.floor(Date.now() / 1000),
  });
  // Garde-fou : la page ne facture jamais autre chose que le total calculé par le serveur.
  if (checkoutTotal(params) !== order.total_cents) return reply(500, { error: 'amount_mismatch' });

  const session = await stripeRequest('POST', 'checkout/sessions', params, {
    account: shop.stripe_account_id,
  });
  const id = session.body?.id;
  const url = session.body?.url;
  if (session.status >= 300 || typeof id !== 'string' || typeof url !== 'string') {
    return reply(502, { error: 'stripe_failed' });
  }

  // La page est ouverte : la réservation tient le temps de payer (la page vit 30 minutes). Sous
  // condition — toujours à payer, et toujours avec l'ancienne page (ou aucune) : si la réservation a
  // été annulée ou a changé de page entre-temps, on referme celle qu'on vient d'ouvrir.
  const pending = admin
    .from('flash_orders')
    .update({
      stripe_checkout_id: id,
      reserved_until: new Date(Date.now() + 30 * 60_000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id)
    .eq('status', 'paiement_attente');
  const { data: kept, error } = await (
    previous ? pending.eq('stripe_checkout_id', previous) : pending.is('stripe_checkout_id', null)
  )
    .select('id')
    .maybeSingle();
  if (error) return reply(500, { error: 'server_error' });
  if (!kept) {
    await stripeRequest(
      'POST',
      `checkout/sessions/${encodeURIComponent(id)}/expire`,
      {},
      { account: shop.stripe_account_id },
    ).catch(() => null);
    return reply(409, { error: 'order_locked' });
  }

  return reply(200, { url, totalCents: order.total_cents });
});
