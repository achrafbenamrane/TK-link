// Associe un numéro de téléphone au compte connecté — SANS code, pour l'instant (décision du client,
// 24/10/2026 ; la vérification par SMS viendra avec Prelude).
//
// Pourquoi une fonction serveur : se connecter par téléphone exige un numéro CONFIRMÉ sur l'identité
// Auth, et seul l'API d'administration (service_role) peut le poser sans code. Le client ne le peut
// pas, et ne doit pas le pouvoir (le crochet « Send SMS » refuse tout envoi, migration 0008).
//
// Garde-fous, puisqu'aucun code ne prouve que le numéro appartient à la personne :
//   - l'adresse e-mail du compte doit être confirmée : la connexion par téléphone ne regarde pas
//     l'e-mail, et confirmer un numéro efface les codes e-mail en attente ;
//   - un compte n'associe qu'UN numéro (le changer passe par le support) : `phone_locked` ;
//   - CINQ numéros différents par compte et par 24 heures (`record_phone_link_attempt`) : refuser un
//     numéro pris dit qu'il a un compte, et personne ne doit pouvoir en tester en série. Réessayer le
//     MÊME numéro ne compte pas (l'app le réessaie à chaque ouverture tant qu'il n'est pas associé) ;
//   - un numéro déjà pris par un autre compte est refusé : `phone_exists`. L'API d'administration ne
//     le vérifie pas (un doublon n'y remonte qu'en erreur 500) : on demande AVANT (`phone_is_taken`),
//     et encore APRÈS un échec, pour le cas où un autre compte l'a pris entre-temps ;
//   - le profil n'est PAS marqué « vérifié » (`phone_verified` reste faux, migration 0008).
//
// Sécurité : l'appelant est authentifié ICI — `auth.getUser()` avec son jeton, vérifié par le
// serveur Auth (401 sinon) — et jamais d'après un identifiant envoyé dans le corps. La vérification
// « legacy secret » de la plateforme est désactivée (voir supabase/config.toml).
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { serve } from '../_shared/http.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const E164 = /^\+[1-9]\d{7,14}$/;
const MAX_NUMBERS_PER_DAY = 5;

// Le navigateur (aperçu web, back-office) demande d'abord la permission (`OPTIONS`) et refuse toute
// réponse sans ces en-têtes. Le téléphone ne les regarde pas. Aucun cookie n'est utilisé (l'appelant
// s'identifie par son jeton dans `Authorization`), donc « * » n'ouvre rien de plus.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' });

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return reply(401, { error: 'unauthorized' });

  // L'appelant, d'après SON jeton (vérifié par le serveur Auth).
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) return reply(401, { error: 'unauthorized' });
  if (!user.email_confirmed_at) return reply(403, { error: 'email_not_confirmed' });

  let raw: unknown;
  try {
    raw = ((await req.json()) as { phone?: unknown } | null)?.phone;
  } catch {
    return reply(400, { error: 'invalid_phone' });
  }
  if (typeof raw !== 'string' || !E164.test(raw)) return reply(400, { error: 'invalid_phone' });
  const phone: string = raw;

  // Supabase range le numéro SANS le « + ».
  const current = user.phone ? `+${user.phone}` : '';
  if (current && current !== phone) return reply(409, { error: 'phone_locked' });
  // Déjà associé (un second appel, une autre installation) : rien à refaire.
  if (current === phone && user.phone_confirmed_at) return reply(200, { ok: true });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: numbersTried, error: countError } = await admin.rpc('record_phone_link_attempt', {
    p_user: user.id,
    p_phone: phone,
  });
  if (countError || typeof numbersTried !== 'number') return reply(500, { error: 'server_error' });
  if (numbersTried > MAX_NUMBERS_PER_DAY) return reply(429, { error: 'too_many_attempts' });

  const taken = async (): Promise<boolean | null> => {
    const { data, error } = await admin.rpc('phone_is_taken', { p_phone: phone, p_user: user.id });
    return error ? null : data === true;
  };

  const before = await taken();
  if (before === null) return reply(500, { error: 'server_error' });
  if (before) return reply(409, { error: 'phone_exists' });

  const { error } = await admin.auth.admin.updateUserById(user.id, {
    phone,
    phone_confirm: true,
  });
  if (error) {
    // Pris entre-temps par un autre compte : la contrainte d'unicité a parlé (erreur 500 générique).
    return (await taken())
      ? reply(409, { error: 'phone_exists' })
      : reply(500, { error: 'server_error' });
  }

  return reply(200, { ok: true });
});
