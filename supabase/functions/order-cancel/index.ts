// Annule une réservation dont la page de paiement Stripe est OUVERTE — appelé par l'ACHETEUR, quand
// `cancel_order` a répondu `checkout_open` (migration 0020).
//
// On fait d'abord expirer la page chez Stripe (au nom du compte du commerce, Direct charges) : plus
// personne ne peut y payer. Puis la réservation est annulée et son stock rendu
// (`cancel_order_after_checkout`, réservée au serveur) — À CONDITION que la commande porte encore
// CETTE page : si une autre s'est ouverte entre-temps, on répond `checkout_open` (l'app dit de
// réessayer). Si le paiement vient d'aboutir, Stripe refuse l'expiration et la commande reste payée.
//
// Sécurité : l'appelant est identifié par son jeton et doit être l'acheteur de la commande.
import { adminClient, callerOf, CORS, jsonBody, reply, UUID } from '../_shared/http.ts';
import { afterExpire } from '../_shared/stripe.ts';
import { stripeConfigured, stripeRequest } from '../_shared/stripe-api.ts';

// Stripe injoignable : une réponse JSON quand même, jamais une erreur 500 en texte brut.
const unreachable = { status: 0, body: null };

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
  const { data: order, error: readError } = await admin
    .from('flash_orders')
    .select('id, customer_id, shop_id, status, stripe_payment_intent_id, stripe_checkout_id')
    .eq('id', orderId)
    .maybeSingle();
  if (readError) return reply(500, { error: 'server_error' });
  if (!order || order.customer_id !== user.id) return reply(404, { error: 'order_not_found' });
  if (order.status !== 'paiement_attente' || order.stripe_payment_intent_id) {
    return reply(409, { error: 'not_cancellable' });
  }

  const checkout = (order.stripe_checkout_id as string | null) ?? null;
  if (checkout) {
    const { data: shop } = await admin
      .from('shops')
      .select('stripe_account_id')
      .eq('id', order.shop_id)
      .maybeSingle();
    const account = shop?.stripe_account_id as string | null | undefined;
    // Sans compte Stripe, la page ne peut pas avoir été ouverte : réponse anormale de la base.
    if (!account) return reply(502, { error: 'stripe_failed' });

    const path = `checkout/sessions/${encodeURIComponent(checkout)}`;
    const expired = await stripeRequest('POST', `${path}/expire`, {}, { account }).catch(
      () => unreachable,
    );
    let sessionStatus: unknown = null;
    if (expired.status < 200 || expired.status >= 300) {
      const current = await stripeRequest('GET', path, {}, { account }).catch(() => unreachable);
      sessionStatus = current.body?.status;
    }
    const decision = afterExpire(expired.status, sessionStatus);
    if (decision === 'already_paid') return reply(409, { error: 'already_paid' });
    if (decision === 'stripe_failed') return reply(502, { error: 'stripe_failed' });
  }

  // Annuler CETTE réservation, avec CETTE page (ou aucune) : pas une page ouverte entre-temps.
  const { error } = await admin.rpc('cancel_order_after_checkout', {
    p_order: order.id,
    p_checkout: checkout,
  });
  if (error) {
    const motif = /checkout_open/.test(error.message)
      ? 'checkout_open'
      : /not_cancellable/.test(error.message)
        ? 'not_cancellable'
        : null;
    return motif ? reply(409, { error: motif }) : reply(500, { error: 'server_error' });
  }
  return reply(200, { cancelled: true });
});
