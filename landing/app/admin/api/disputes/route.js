/**
 * Les litiges, côté serveur du back-office : lire les commandes en « litige » et trancher.
 *
 * Sous `/admin` : la serrure (middleware.js) protège cette route comme la page. Elle parle à Supabase
 * avec la clé de SERVICE — qui contourne la RLS — et ne doit donc exister QUE côté serveur : variable
 * `SUPABASE_SERVICE_ROLE_KEY` sur Vercel, jamais préfixée `NEXT_PUBLIC_`. Sans elle (ou sans
 * `SUPABASE_URL`), la route répond 503 et la page garde ses litiges de démonstration.
 *
 * Trancher (`PATCH`) écrit la décision, motivée et datée (migration 0021), et le statut qui en
 * découle — sous condition : la commande doit être TOUJOURS en litige (deux onglets ouverts ne
 * tranchent pas deux fois). Le remboursement lui-même se fait dans Stripe : le back-office n'a
 * aucune clé Stripe, et n'en a pas besoin.
 */
import { OUTCOMES, statusAfter, toDisputes, validNote } from '../../disputes';

export const dynamic = 'force-dynamic';

const URL_ = process.env.SUPABASE_URL ?? '';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (status, body) => Response.json(body, { status });

const rest = (path, init = {}) =>
  fetch(`${URL_}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  });

const configured = () => URL_.startsWith('https://') && KEY.length > 0;

const BASE =
  'id,customer_id,shop_id,fulfilment,status,total_cents,stripe_payment_intent_id,uber_status,updated_at';

export async function GET() {
  if (!configured()) return json(503, { error: 'not_configured' });
  // Avec la migration 0021 : les litiges ouverts ET ceux déjà tranchés (la décision reste à l'écran).
  // Sans elle : les litiges ouverts seulement.
  let res = await rest(
    `flash_orders?select=${BASE},dispute_outcome,dispute_note,dispute_decided_at` +
      '&or=(status.eq.litige,dispute_decided_at.not.is.null)&order=updated_at.desc&limit=100',
  );
  if (!res.ok) {
    res = await rest(
      `flash_orders?select=${BASE}&status=eq.litige&order=updated_at.desc&limit=100`,
    );
  }
  if (!res.ok) return json(502, { error: 'supabase_failed' });
  const orders = await res.json();
  if (orders.length === 0) return json(200, { disputes: [], rulings: {} });

  const list = (ids) => [...new Set(ids.filter(Boolean))].join(',');
  const [shops, profiles, tickets] = await Promise.all([
    rest(`shops?select=id,name,stripe_account_id&id=in.(${list(orders.map((o) => o.shop_id))})`),
    rest(
      `profiles?select=id,first_name,last_name&id=in.(${list(orders.map((o) => o.customer_id))})`,
    ),
    rest(
      'support_tickets?select=order_id,category,support_messages(body,from_staff,created_at)' +
        `&order_id=in.(${list(orders.map((o) => o.id))})&order=created_at.desc`,
    ),
  ]);
  const read = async (r) => (r.ok ? r.json() : []);
  return json(
    200,
    toDisputes(orders, await read(shops), await read(profiles), await read(tickets)),
  );
}

/** Trancher : `{ orderId, outcome, note }`. */
export async function PATCH(request) {
  if (!configured()) return json(503, { error: 'not_configured' });
  const input = await request.json().catch(() => null);
  const note = validNote(input?.note);
  if (!UUID.test(String(input?.orderId ?? '')) || !OUTCOMES.includes(input?.outcome) || !note) {
    return json(400, { error: 'invalid' });
  }

  const found = await rest(`flash_orders?select=fulfilment,status&id=eq.${input.orderId}`);
  if (!found.ok) return json(502, { error: 'supabase_failed' });
  const [order] = await found.json();
  if (!order || order.status !== 'litige') return json(409, { error: 'not_in_dispute' });

  const res = await rest(`flash_orders?id=eq.${input.orderId}&status=eq.litige`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      status: statusAfter(input.outcome, order.fulfilment),
      dispute_outcome: input.outcome,
      dispute_note: note,
      dispute_decided_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });
  if (!res.ok) return json(502, { error: 'supabase_failed' });
  const changed = await res.json();
  // Tranché entre-temps (autre onglet, remboursement arrivé de Stripe) : rien n'a été écrit.
  return changed.length ? json(200, { ok: true }) : json(409, { error: 'not_in_dispute' });
}
