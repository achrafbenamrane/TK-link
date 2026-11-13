// Ce que partagent les fonctions Edge appelées par l'app : CORS, réponses JSON, et l'appelant
// identifié d'après SON jeton (vérifié par le serveur Auth) — jamais d'après le corps de la requête.
import { createClient, type SupabaseClient, type User } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

// Le navigateur (aperçu web, back-office) demande d'abord la permission (`OPTIONS`). Aucun cookie :
// l'appelant s'identifie par son jeton, donc « * » n'ouvre rien de plus.
export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

/** Le client « service_role » : contourne la RLS, à n'utiliser qu'APRÈS avoir vérifié l'appelant. */
export const adminClient = (): SupabaseClient =>
  createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

/** L'appelant connecté, ou `null` (→ 401). */
export async function callerOf(req: Request): Promise<User | null> {
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.auth.getUser();
  return error ? null : data.user;
}

/** Le corps JSON, ou `null` s'il est illisible. */
export async function jsonBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
