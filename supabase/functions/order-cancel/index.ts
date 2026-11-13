// Annule une réservation dont la page de paiement Stripe est OUVERTE — appelé par l'ACHETEUR, quand
// `cancel_order` a répondu `checkout_open` (migration 0020).
//
// On fait d'abord expirer la page chez Stripe (au nom du compte du commerce, Direct charges) : plus
// personne ne peut y payer. Puis la réservation est annulée et son stock rendu
// (`cancel_order_after_checkout`, réservée au serveur). Si le paiement vient d'aboutir, Stripe refuse
// l'expiration et la commande reste payée — on ne rend pas un stock déjà vendu.
//
// Sécurité : l'appelant est identifié par son jeton et doit être l'acheteur de la commande.
import { adminClient, callerOf, CORS, jsonBody, reply, UUID } from '../_shared/http.ts';
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
    .select('id, customer_id, shop_id, status, stripe_payment_intent_id, stripe_checkout_id')
    .eq('id', orderId)
    .maybeSingle();
  if (!order || order.customer_id !== user.id) return reply(404, { error: 'order_not_found' });
  if (order.status !== 'paiement_attente' || order.stripe_payment_intent_id) {
    return reply(409, { error: 'not_cancellable' });
  }

  if (order.stripe_checkout_id) {
    const { data: shop } = await admin
      .from('shops')
      .select('stripe_account_id')
      .eq('id', order.shop_id)
      .maybeSingle();
    const account = shop?.stripe_account_id as string | null | undefined;
    if (!account) return reply(409, { error: 'not_cancellable' });

    const path = `checkout/sessions/${encodeURIComponent(order.stripe_checkout_id)}`;
    const expired = await stripeRequest('POST', `${path}/expire`, {}, { account });
    if (expired.status >= 300) {
      // Déjà expirée (30 minutes passées) : on peut annuler. Payée entre-temps : on ne touche à rien.
      const current = await stripeRequest('GET', path, {}, { account });
      const state = current.body?.status;
      if (state === 'complete') return reply(409, { error: 'already_paid' });
      if (state !== 'expired') return reply(502, { error: 'stripe_failed' });
    }
  }

  const { error } = await admin.rpc('cancel_order_after_checkout', { p_order: order.id });
  if (error) {
    return reply(409, {
      error: /not_cancellable/.test(error.message) ? 'not_cancellable' : 'server_error',
    });
  }
  return reply(200, { cancelled: true });
});
