/**
 * Les réglages du SERVEUR (migration 0022), côté back-office : les lire, en changer un.
 *
 * Sous `/admin` : la serrure (middleware.js) protège cette route. Clé de SERVICE côté serveur
 * seulement (`SUPABASE_SERVICE_ROLE_KEY` sur Vercel). Sans elle, ou sans la migration 0022, la route
 * répond 503 : la page n'affiche que ses réglages de démonstration.
 */
import { SERVER_SETTINGS } from '../../server-settings';

export const dynamic = 'force-dynamic';

const URL_ = process.env.SUPABASE_URL ?? '';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const json = (status, body) => Response.json(body, { status });

const rpc = (fn, args = {}) =>
  fetch(`${URL_}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
    cache: 'no-store',
  });

const configured = () => URL_.startsWith('https://') && KEY.length > 0;

export async function GET() {
  if (!configured()) return json(503, { error: 'not_configured' });
  const res = await rpc('admin_platform_settings');
  // Fonction absente : la migration 0022 n'est pas appliquée.
  if (res.status === 404) return json(503, { error: 'migration_missing' });
  if (!res.ok) return json(502, { error: 'supabase_failed' });
  return json(200, { settings: await res.json() });
}

/** Changer un réglage : `{ key, value }` — la valeur ENTIÈRE du serveur (points de base, centimes…). */
export async function PATCH(request) {
  if (!configured()) return json(503, { error: 'not_configured' });
  const input = await request.json().catch(() => null);
  const known = SERVER_SETTINGS.some((s) => s.key === input?.key);
  if (!known || !Number.isInteger(input?.value)) return json(400, { error: 'invalid' });
  const res = await rpc('admin_set_platform_setting', { p_key: input.key, p_value: input.value });
  if (res.ok) return json(200, { ok: true });
  // Le serveur refuse (hors bornes) : on rend son motif.
  const body = await res.json().catch(() => null);
  const motif = /invalid_value|unknown_setting/.exec(String(body?.message ?? ''))?.[0];
  return json(motif ? 400 : 502, { error: motif ?? 'supabase_failed' });
}
