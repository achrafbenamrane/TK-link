// Ouvre (ou reprend) l'inscription du commerçant chez Stripe, pour être payé dans l'app — appelé
// par le COMMERÇANT depuis son espace. Rend l'adresse de la page Stripe à ouvrir.
//
// CDC V1.1 : Stripe Connect, « Direct charges ». Un compte Express par commerce, créé ici au premier
// appel et rattaché au dossier (`shops.stripe_account_id`). Stripe recueille lui-même l'identité,
// l'IBAN et les justificatifs ; TK LINK n'en voit rien. Le webhook (`account.updated`) dit quand le
// commerce peut encaisser.
//
// Sécurité : l'appelant est identifié par son jeton et doit être le titulaire d'un commerce VALIDÉ.
import { adminClient, callerOf, CORS, reply } from '../_shared/http.ts';
import { stripeConfigured, stripeRequest } from '../_shared/stripe-api.ts';

// Pages de retour (https obligatoire chez Stripe) : le site TK LINK dit « revenez dans l'app ».
const RETURN_URL =
  Deno.env.get('STRIPE_CONNECT_RETURN_URL') ?? 'https://tklink.vercel.app/stripe/retour';
const REFRESH_URL =
  Deno.env.get('STRIPE_CONNECT_REFRESH_URL') ?? 'https://tklink.vercel.app/stripe/relancer';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
  if (!stripeConfigured()) return reply(503, { error: 'stripe_not_configured' });

  const user = await callerOf(req);
  if (!user) return reply(401, { error: 'unauthorized' });

  const admin = adminClient();
  const { data: shop } = await admin
    .from('shops')
    .select('id, name, status, stripe_account_id')
    .eq('owner_id', user.id)
    .maybeSingle();
  if (!shop) return reply(404, { error: 'no_shop' });
  if (shop.status !== 'valide') return reply(409, { error: 'shop_not_validated' });

  let account = shop.stripe_account_id as string | null;
  if (!account) {
    const created = await stripeRequest(
      'POST',
      'accounts',
      {
        type: 'express',
        country: 'FR',
        ...(user.email ? { email: user.email } : {}),
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
        business_profile: { name: shop.name },
        metadata: { shop_id: shop.id },
      },
      // Deux appuis simultanés ne créent qu'un compte.
      { idempotencyKey: `tklink-shop-${shop.id}` },
    );
    const id = created.body?.id;
    if (created.status >= 300 || typeof id !== 'string')
      return reply(502, { error: 'stripe_failed' });
    account = id;
    const { error } = await admin
      .from('shops')
      .update({ stripe_account_id: account })
      .eq('id', shop.id)
      .is('stripe_account_id', null);
    if (error) return reply(500, { error: 'server_error' });
  }

  const link = await stripeRequest('POST', 'account_links', {
    account,
    type: 'account_onboarding',
    return_url: RETURN_URL,
    refresh_url: REFRESH_URL,
  });
  const url = link.body?.url;
  if (link.status >= 300 || typeof url !== 'string') return reply(502, { error: 'stripe_failed' });

  return reply(200, { url });
});
