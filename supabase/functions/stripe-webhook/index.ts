// Les nouvelles de Stripe : paiement réussi (la commande passe « payée », ce qui vaut acceptation —
// CDC V1.1), remboursement total (« remboursée »), compte d'un commerçant activé (il peut encaisser).
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
    // Le cas normal : la réservation attendait son paiement.
    let paid = admin
      .from('flash_orders')
      .update({ status: 'payee', paid_at: now, updated_at: now })
      .eq('stripe_payment_intent_id', effect.paymentIntentId)
      .eq('status', 'paiement_attente');
    if (effect.orderId) paid = paid.eq('id', effect.orderId);
    const { data, error } = await paid.select('id');
    if (error) return new Response(null, { status: 500 });

    if (!data?.length) {
      // Payée APRÈS l'expiration de sa réservation (stock rendu entre-temps) : le client a payé,
      // la commande n'est plus garantie. « Litige » : TK LINK rembourse ou honore, à la main.
      const { error: lateError } = await admin
        .from('flash_orders')
        .update({ status: 'litige', paid_at: now, updated_at: now })
        .eq('stripe_payment_intent_id', effect.paymentIntentId)
        .eq('status', 'annulee');
      if (lateError) return new Response(null, { status: 500 });
    }
  } else if (effect.kind === 'order_refunded') {
    const { error } = await admin
      .from('flash_orders')
      .update({ status: 'remboursee', updated_at: now })
      .eq('stripe_payment_intent_id', effect.paymentIntentId)
      .neq('status', 'remboursee');
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
