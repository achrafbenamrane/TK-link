// Les nouvelles de Stripe : paiement réussi (la commande passe « payée », ce qui vaut acceptation —
// CDC V1.1), remboursement total (« remboursée »), remboursement échoué et contestation bancaire
// (« litige », 0027), compte d'un commerçant activé (il peut encaisser).
//
// À déclarer dans Stripe comme point de terminaison CONNECT (« événements des comptes connectés ») :
// en Direct charges, les paiements naissent sur le compte du commerçant.
//
// Sécurité : pas de jeton Supabase (`verify_jwt = false`). La requête est authentifiée par
// l'en-tête `Stripe-Signature` (HMAC du corps brut avec STRIPE_WEBHOOK_SECRET, moins de 5 minutes).
// Rejouer un événement ne change rien de plus (les mises à jour sont conditionnées au statut).
import { adminClient } from '../_shared/http.ts';
import { effectOf, verifyStripeSignature } from '../_shared/stripe.ts';

const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response(null, { status: 405 });

  const raw = await req.text();
  const signed = await verifyStripeSignature(
    raw,
    req.headers.get('Stripe-Signature'),
    WEBHOOK_SECRET,
    Math.floor(Date.now() / 1000),
  );
  if (!signed) return new Response(null, { status: 401 });

  let effect;
  try {
    effect = effectOf(JSON.parse(raw));
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!effect) return new Response(null, { status: 200 });

  const admin = adminClient();
  const now = new Date().toISOString();

  if (effect.kind === 'order_paid') {
    // Le paiement naît sur la page Checkout : la commande se retrouve par son identifiant (porté
    // dans les métadonnées du paiement), et garde dès lors l'identifiant du paiement (remboursements).
    // Sans identifiant de commande (paiement créé hors de TK LINK) : rien à faire.
    if (!effect.orderId) return new Response(null, { status: 200 });

    // Le cas normal : la réservation attendait son paiement.
    const { data, error } = await admin
      .from('flash_orders')
      .update({
        status: 'payee',
        paid_at: now,
        updated_at: now,
        stripe_payment_intent_id: effect.paymentIntentId,
      })
      .eq('id', effect.orderId)
      .eq('status', 'paiement_attente')
      .select('id');
    if (error) return new Response(null, { status: 500 });

    if (!data?.length) {
      // Payée APRÈS l'expiration de sa réservation (stock rendu entre-temps) : le client a payé,
      // la commande n'est plus garantie. « Litige » : TK LINK rembourse ou honore, à la main.
      const { error: lateError } = await admin
        .from('flash_orders')
        .update({
          status: 'litige',
          paid_at: now,
          updated_at: now,
          stripe_payment_intent_id: effect.paymentIntentId,
        })
        .eq('id', effect.orderId)
        .eq('status', 'annulee');
      if (lateError) return new Response(null, { status: 500 });
    }
  } else if (effect.kind === 'order_refunded') {
    const { error } = await admin
      .from('flash_orders')
      .update({ status: 'remboursee', refund_failure: null, updated_at: now })
      .eq('stripe_payment_intent_id', effect.paymentIntentId)
      .neq('status', 'remboursee');
    if (error) return new Response(null, { status: 500 });
  } else if (effect.kind === 'refund_failed') {
    // L'argent n'est pas revenu au client (0027) : « litige », la raison pour le back-office.
    const { error } = await admin
      .from('flash_orders')
      .update({ status: 'litige', refund_failure: effect.reason.slice(0, 200), updated_at: now })
      .eq('stripe_payment_intent_id', effect.paymentIntentId)
      .in('status', ['remboursement_en_cours', 'remboursee']);
    if (error) return new Response(null, { status: 500 });
  } else if (effect.kind === 'order_disputed') {
    // Contestation bancaire (0027) : la commande garde la trace de la contestation, et passe en
    // « litige » si elle était en cours ou honorée. Remboursée (ou en passe de l'être) : elle le reste.
    const { error: markError } = await admin
      .from('flash_orders')
      .update({ stripe_dispute_id: effect.disputeId, updated_at: now })
      .eq('stripe_payment_intent_id', effect.paymentIntentId);
    if (markError) return new Response(null, { status: 500 });
    const { error } = await admin
      .from('flash_orders')
      .update({ status: 'litige', updated_at: now })
      .eq('stripe_payment_intent_id', effect.paymentIntentId)
      .in('status', [
        'payee',
        'acceptee',
        'preparation',
        'prete',
        'en_livraison',
        'recuperee',
        'livree',
      ]);
    if (error) return new Response(null, { status: 500 });
  } else {
    const { error } = await admin
      .from('shops')
      .update({ stripe_charges_enabled: effect.chargesEnabled })
      .eq('stripe_account_id', effect.accountId);
    if (error) return new Response(null, { status: 500 });
  }

  return new Response(null, { status: 200 });
});
