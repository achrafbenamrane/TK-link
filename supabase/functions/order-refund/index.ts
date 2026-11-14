// Rembourse une commande passée « remboursement en cours » (migration 0027) : par le client qui
// signale « je n'ai rien reçu » avant la remise, ou par la décision « Rembourser » du back-office.
//
// Appelée par le déclencheur `flash_orders_refund` (pg_net), méthode POST, corps `{ order_id }`, avec
// l'en-tête `x-webhook-secret: <PUSH_WEBHOOK_SECRET>` (le même secret que `push-events`).
//
// Le remboursement est TOTAL, créé au nom du commerce (Direct charges), frais de TK LINK compris. Il
// ne part qu'une fois : la commande doit être ENCORE « remboursement en cours », la clé d'idempotence
// est celle de la tentative, et Stripe refuse de rembourser deux fois un paiement déjà remboursé en
// entier. Ce qui empêche de rembourser seul (pas de clé Stripe,
// coursier en route, refus de Stripe) renvoie la commande en « litige » avec la raison : le back-office
// tranche. Le webhook Stripe (`charge.refunded`) la passe « remboursée » si ce n'est déjà fait ici.
//
// Sécurité : pas de jeton Supabase (`verify_jwt = false`) ; seul l'identifiant de la commande vient de
// la requête — le montant, le paiement et le compte sont relus en base.
import { adminClient, sameSecret, UUID } from '../_shared/http.ts';
import { afterRefund, refundPlan, type RefundableOrder } from '../_shared/stripe.ts';
import { stripeConfigured, stripeRequest } from '../_shared/stripe-api.ts';

const SECRET = Deno.env.get('PUSH_WEBHOOK_SECRET') ?? '';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response(null, { status: 405 });
  if (!sameSecret(SECRET, req.headers.get('x-webhook-secret') ?? '')) {
    return new Response(null, { status: 401 });
  }

  const orderId = ((await req.json().catch(() => null)) as { order_id?: unknown } | null)?.order_id;
  if (typeof orderId !== 'string' || !UUID.test(orderId))
    return new Response(null, { status: 400 });

  const admin = adminClient();
  const { data: order, error } = await admin
    .from('flash_orders')
    .select(
      'id, shop_id, status, stripe_payment_intent_id, uber_delivery_id, uber_status, updated_at',
    )
    .eq('id', orderId)
    .maybeSingle();
  if (error) return new Response(null, { status: 500 });
  if (!order) return new Response(null, { status: 200 });

  const { data: shop } = await admin
    .from('shops')
    .select('stripe_account_id')
    .eq('id', order.shop_id)
    .maybeSingle();

  const plan = refundPlan(
    order as RefundableOrder,
    (shop?.stripe_account_id as string | null | undefined) ?? null,
    stripeConfigured(),
  );
  if (plan.kind === 'skip') return new Response(null, { status: 200 });

  let outcome: ReturnType<typeof afterRefund>;
  if (plan.kind === 'manual') {
    outcome = { status: 'litige', refundId: null, failure: plan.reason };
  } else {
    const res = await stripeRequest('POST', 'refunds', plan.params, {
      account: plan.account,
      idempotencyKey: plan.idempotencyKey,
    }).catch(() => ({ status: 0, body: null }));
    outcome = afterRefund(res.status, res.body);
    if (outcome.failure) console.error('order_refund_failed', order.id, outcome.failure);
  }

  // Seulement si elle attend TOUJOURS son remboursement : le webhook a pu la passer « remboursée ».
  const { error: writeError } = await admin
    .from('flash_orders')
    .update({
      status: outcome.status,
      ...(outcome.refundId ? { stripe_refund_id: outcome.refundId } : {}),
      refund_failure: outcome.failure,
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id)
    .eq('status', 'remboursement_en_cours');
  if (writeError) return new Response(null, { status: 500 });

  return new Response(null, { status: 200 });
});
