// L'onglet « Versements » du commerçant, lu chez Stripe — V1.1, Commerçant > Flux finance (VALIDÉ) :
// « le calendrier et les montants de paiement issus de Stripe Connect — TK Link ne construit pas de
// moteur de trésorerie propre, il expose les données déjà disponibles côté PSP ».
//
// Rend, pour le compte Stripe du commerce de l'appelant : le solde (disponible, en attente) et les
// dix derniers virements vers sa banque. Rien n'est écrit, ni chez Stripe ni en base.
//
// Sécurité : l'appelant est identifié par son jeton ; on ne lit que le compte de SON commerce.
import { adminClient, callerOf, CORS, reply } from '../_shared/http.ts';
import { parseBalance, parsePayouts } from '../_shared/stripe.ts';
import { stripeConfigured, stripeRequest } from '../_shared/stripe-api.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
  if (!stripeConfigured()) return reply(503, { error: 'stripe_not_configured' });

  const user = await callerOf(req);
  if (!user) return reply(401, { error: 'unauthorized' });

  const { data: shop, error: readError } = await adminClient()
    .from('shops')
    .select('id, stripe_account_id')
    .eq('owner_id', user.id)
    .maybeSingle();
  if (readError) return reply(500, { error: 'server_error' });
  if (!shop) return reply(404, { error: 'no_shop' });
  const account = shop.stripe_account_id as string | null;
  if (!account) return reply(409, { error: 'not_onboarded' });

  // Stripe injoignable : une réponse JSON quand même, jamais une erreur 500 en texte brut.
  const unreachable = { status: 0, body: null };
  const [balance, payouts] = await Promise.all([
    stripeRequest('GET', 'balance', {}, { account }).catch(() => unreachable),
    stripeRequest('GET', 'payouts', { limit: 10 }, { account }).catch(() => unreachable),
  ]);
  const parsed = balance.status >= 200 && balance.status < 300 ? parseBalance(balance.body) : null;
  // Un compte récent a une liste de virements VIDE (200) ; un échec n'est pas « aucun virement ».
  if (!parsed || payouts.status < 200 || payouts.status >= 300) {
    return reply(502, { error: 'stripe_failed' });
  }

  return reply(200, { ...parsed, payouts: parsePayouts(payouts.body) });
});
