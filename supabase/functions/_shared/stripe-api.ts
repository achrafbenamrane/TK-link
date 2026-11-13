// Les appels à l'API Stripe (sans SDK : `fetch` et le format de formulaire de Stripe). Secrets :
//   STRIPE_SECRET_KEY (sk_test_… en test, sk_live_… en production), STRIPE_WEBHOOK_SECRET (whsec_…).
import { STRIPE_API, stripeForm } from './stripe.ts';

const SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';

export const stripeConfigured = (): boolean => SECRET_KEY.startsWith('sk_');

/**
 * Un appel à Stripe. `account` : pour agir AU NOM d'un compte connecté (Direct charges).
 * `idempotencyKey` : rejouer la même requête ne crée rien deux fois.
 */
export async function stripeRequest(
  method: 'GET' | 'POST',
  path: string,
  params: Record<string, unknown> = {},
  opts: { account?: string; idempotencyKey?: string } = {},
): Promise<{ status: number; body: Record<string, unknown> | null }> {
  const form = stripeForm(params);
  const url = method === 'GET' && form ? `${STRIPE_API}/${path}?${form}` : `${STRIPE_API}/${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${SECRET_KEY}`,
      ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      ...(opts.account ? { 'Stripe-Account': opts.account } : {}),
      ...(opts.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {}),
    },
    ...(method === 'POST' ? { body: form } : {}),
  });
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  return { status: res.status, body };
}
