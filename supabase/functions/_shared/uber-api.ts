// Les appels à l'API Uber Direct, avec le jeton OAuth gardé en mémoire de l'instance (il vaut 30
// jours ; on le renouvelle une heure avant). Secrets Supabase requis :
//   UBER_CUSTOMER_ID, UBER_CLIENT_ID, UBER_CLIENT_SECRET (tableau de bord Uber Direct → Developer).
import { UBER_API_URL, UBER_AUTH_URL, UBER_SCOPE } from './uber.ts';

const CUSTOMER_ID = Deno.env.get('UBER_CUSTOMER_ID') ?? '';
const CLIENT_ID = Deno.env.get('UBER_CLIENT_ID') ?? '';
const CLIENT_SECRET = Deno.env.get('UBER_CLIENT_SECRET') ?? '';

export const uberConfigured = (): boolean => Boolean(CUSTOMER_ID && CLIENT_ID && CLIENT_SECRET);

let cached: { token: string; expiresAt: number } | null = null;

async function token(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 3_600_000) return cached.token;
  const res = await fetch(UBER_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'client_credentials',
      scope: UBER_SCOPE,
    }),
  });
  const body = (await res.json().catch(() => null)) as {
    access_token?: string;
    expires_in?: number;
  } | null;
  if (!res.ok || !body?.access_token) throw new Error(`uber_auth_${res.status}`);
  cached = { token: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return cached.token;
}

/** Un appel à l'API pour le compte TK LINK. Rend le statut HTTP et le corps lu (ou `null`). */
export async function uberRequest(
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>,
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${UBER_API_URL}/${encodeURIComponent(CUSTOMER_ID)}/${path}`, {
    method,
    headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}
