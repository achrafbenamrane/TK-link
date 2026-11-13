/**
 * Le support, côté serveur du back-office : lire les demandes, répondre, changer leur statut.
 *
 * Sous `/admin` : la serrure (middleware.js) protège cette route comme la page. Elle parle à Supabase
 * avec la clé de SERVICE — qui contourne la RLS — et ne doit donc exister QUE côté serveur : variable
 * `SUPABASE_SERVICE_ROLE_KEY` sur Vercel, jamais préfixée `NEXT_PUBLIC_`, jamais envoyée au
 * navigateur. Sans elle (ou sans `SUPABASE_URL`), la route répond 503 et la page garde ses
 * conversations de démonstration.
 *
 * Une réponse écrite ici porte `from_staff = true` : la base ne l'accepte que d'un appel serveur
 * (migration 0014, le client ne peut pas écrire cette colonne).
 */
import { STATUS_LABEL, toThreads, validReply } from '../../support';

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

export async function GET() {
  if (!configured()) return json(503, { error: 'not_configured' });
  const res = await rest(
    'support_tickets?select=id,author_id,category,subject,status,order_id,last_message_at,' +
      'support_messages(id,body,from_staff,created_at)&order=last_message_at.desc&limit=200',
  );
  if (!res.ok) return json(502, { error: 'supabase_failed' });
  const tickets = await res.json();

  const ids = [...new Set(tickets.map((t) => t.author_id).filter(Boolean))];
  let profiles = [];
  if (ids.length) {
    const p = await rest(
      `profiles?select=id,first_name,last_name,account_type&id=in.(${ids.join(',')})`,
    );
    if (p.ok) profiles = await p.json();
  }
  return json(200, { threads: toThreads(tickets, profiles, Date.now()) });
}

/** Répondre : `{ ticketId, body }`. */
export async function POST(request) {
  if (!configured()) return json(503, { error: 'not_configured' });
  const input = await request.json().catch(() => null);
  const body = validReply(input?.body);
  if (!UUID.test(String(input?.ticketId ?? '')) || !body) return json(400, { error: 'invalid' });
  const res = await rest('support_messages', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ ticket_id: input.ticketId, from_staff: true, body }),
  });
  return res.ok ? json(200, { ok: true }) : json(502, { error: 'supabase_failed' });
}

/** Changer le statut : `{ ticketId, status }` (résolu, fermé, rouvert). */
export async function PATCH(request) {
  if (!configured()) return json(503, { error: 'not_configured' });
  const input = await request.json().catch(() => null);
  if (!UUID.test(String(input?.ticketId ?? '')) || !(input?.status in STATUS_LABEL)) {
    return json(400, { error: 'invalid' });
  }
  const res = await rest(`support_tickets?id=eq.${input.ticketId}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status: input.status, updated_at: new Date().toISOString() }),
  });
  return res.ok ? json(200, { ok: true }) : json(502, { error: 'supabase_failed' });
}
