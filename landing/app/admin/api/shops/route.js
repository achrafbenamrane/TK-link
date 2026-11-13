/**
 * Les dossiers des professionnels, côté serveur du back-office : lire, valider, refuser, rouvrir.
 * Remplace la requête SQL à taper dans le tableau de bord Supabase (docs/architecture/backend.md).
 *
 * Sous `/admin` : la serrure (middleware.js) protège cette route. Clé de SERVICE côté serveur
 * seulement (`SUPABASE_SERVICE_ROLE_KEY`, jamais `NEXT_PUBLIC_`) ; sans elle, 503 et la page garde
 * ses dossiers de démonstration. Le déclencheur `shops_guard` (0010) pose la date de contrôle.
 */
import { decisionsOf, SHOP_DECISIONS, toApplication, validNote } from '../../applications';

export const dynamic = 'force-dynamic';

const URL_ = process.env.SUPABASE_URL ?? '';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (status, body) => Response.json(body, { status });
const configured = () => URL_.startsWith('https://') && KEY.length > 0;
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

const rest = (path, init = {}) =>
  fetch(`${URL_}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) },
    cache: 'no-store',
  });

/** L'e-mail d'un compte (API d'administration d'Auth) ; vide si introuvable. */
async function emailOf(userId) {
  const res = await fetch(`${URL_}/auth/v1/admin/users/${userId}`, { headers, cache: 'no-store' });
  if (!res.ok) return '';
  const user = await res.json().catch(() => null);
  return typeof user?.email === 'string' ? user.email : '';
}

export async function GET() {
  if (!configured()) return json(503, { error: 'not_configured' });
  const res = await rest(
    'shops?select=id,owner_id,kind,name,category,siret,address,status,review_note,submitted_at' +
      '&order=submitted_at.desc&limit=100',
  );
  if (!res.ok) return json(502, { error: 'supabase_failed' });
  const shops = await res.json();

  const owners = [...new Set(shops.map((s) => s.owner_id).filter(Boolean))];
  let profiles = [];
  if (owners.length) {
    const p = await rest(
      `profiles?select=id,first_name,last_name,contact_phone&id=in.(${owners.join(',')})`,
    );
    if (p.ok) profiles = await p.json();
  }
  const byId = new Map(profiles.map((p) => [p.id, p]));
  // Les e-mails des seuls dossiers à trancher : ce sont eux qu'on contacte.
  const emails = new Map(
    await Promise.all(
      shops
        .filter((s) => s.status === 'en_verification')
        .map(async (s) => [s.id, await emailOf(s.owner_id)]),
    ),
  );

  return json(200, {
    applications: shops.map((s) => toApplication(s, byId.get(s.owner_id), emails.get(s.id))),
    decisions: decisionsOf(shops),
  });
}

/** Trancher : `{ shopId, decision: 'valide' | 'refuse' | 'en_verification', note? }`. */
export async function PATCH(request) {
  if (!configured()) return json(503, { error: 'not_configured' });
  const input = await request.json().catch(() => null);
  const decision = input?.decision;
  if (!UUID.test(String(input?.shopId ?? '')) || !SHOP_DECISIONS.includes(decision)) {
    return json(400, { error: 'invalid' });
  }
  const note = decision === 'refuse' ? validNote(input?.note) : null;
  if (decision === 'refuse' && !note) return json(400, { error: 'note_required' });

  const res = await rest(`shops?id=eq.${input.shopId}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status: decision, review_note: note }),
  });
  return res.ok ? json(200, { ok: true }) : json(502, { error: 'supabase_failed' });
}
