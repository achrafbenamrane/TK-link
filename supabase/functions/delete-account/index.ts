// In-app account deletion. Apple Guideline 5.1.1(v) and Google Play both REQUIRE
// an in-app path to fully delete the account + its data. (Store-readiness: STORE-ACCT-DELETE.)
//
// Security: the caller is authenticated HERE — `auth.getUser()` with their token,
// verified by the Auth server (401 otherwise). The platform's legacy-secret JWT
// check is off (see supabase/config.toml): it would reject sessions signed with
// the project's new JWT signing keys. We then delete with the service_role
// admin API. FKs to auth.users use ON DELETE CASCADE, so the user's
// rows (profiles, notes, subscriptions) are removed with them.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

// Browsers (web preview) send a CORS preflight first and drop any response without these headers.
// No cookies are involved — the caller authenticates with the bearer token — so '*' is safe.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return new Response('unauthorized', { status: 401, headers: CORS });
  }

  // Identify the caller from their JWT (network-verified).
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) {
    return new Response('unauthorized', { status: 401, headers: CORS });
  }

  // Delete with admin privileges.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    return new Response('error', { status: 500, headers: CORS });
  }

  return new Response('ok', { status: 200, headers: CORS });
});
