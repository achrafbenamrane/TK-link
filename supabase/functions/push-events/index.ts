// Envoie les notifications quand une commande change de statut ou que TK LINK répond à une demande.
//
// Appelée par deux « Database Webhooks » Supabase (tableau de bord → Database → Webhooks) :
//   - table `flash_orders`, événements INSERT et UPDATE ;
//   - table `support_messages`, événement INSERT ;
// méthode POST vers cette fonction, avec l'en-tête `x-webhook-secret: <PUSH_WEBHOOK_SECRET>`.
//
// Sécurité : pas de jeton Supabase (`verify_jwt = false`) ; la requête est authentifiée par ce
// secret partagé, comparé à temps constant. Les destinataires sont lus en base, jamais dans la
// requête : un appelant ne peut pas choisir à qui écrire.
import { adminClient } from '../_shared/http.ts';
import {
  deadTokens,
  EXPO_PUSH_URL,
  expoBatches,
  orderMessage,
  supportMessage,
} from '../_shared/push.ts';

const SECRET = Deno.env.get('PUSH_WEBHOOK_SECRET') ?? '';
// Facultatif : jeton d'accès Expo, si la « sécurité renforcée des notifications » est activée.
const EXPO_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN') ?? '';

const same = (a: string, b: string): boolean => {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response(null, { status: 405 });
  if (!same(SECRET, req.headers.get('x-webhook-secret') ?? ''))
    return new Response(null, { status: 401 });

  const payload = (await req.json().catch(() => null)) as {
    table?: string;
    record?: Record<string, unknown>;
    old_record?: Record<string, unknown> | null;
  } | null;
  if (!payload?.record) return new Response(null, { status: 400 });

  const admin = adminClient();
  let message = null;
  let userId: string | null = null;

  if (payload.table === 'flash_orders') {
    const r = payload.record as {
      id: string;
      status: string;
      fulfilment: string;
      audience?: string | null;
      customer_id: string;
      shop_id: string;
    };
    message = orderMessage(r, (payload.old_record ?? null) as { status?: string } | null);
    if (message?.to === 'customer') userId = r.customer_id;
    if (message?.to === 'shop_owner') {
      const { data } = await admin
        .from('shops')
        .select('owner_id')
        .eq('id', r.shop_id)
        .maybeSingle();
      userId = data?.owner_id ?? null;
    }
  } else if (payload.table === 'support_messages') {
    const r = payload.record as { ticket_id: string; from_staff: boolean };
    message = supportMessage(r);
    if (message) {
      const { data } = await admin
        .from('support_tickets')
        .select('author_id')
        .eq('id', r.ticket_id)
        .maybeSingle();
      userId = data?.author_id ?? null;
    }
  }
  if (!message || !userId) return new Response(null, { status: 200 });

  const { data: rows } = await admin.from('push_tokens').select('token').eq('user_id', userId);
  const tokens = (rows ?? []).map((r) => r.token as string);

  for (const batch of expoBatches(tokens, message)) {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(EXPO_TOKEN ? { Authorization: `Bearer ${EXPO_TOKEN}` } : {}),
      },
      body: JSON.stringify(batch),
    }).catch(() => null);
    if (!res?.ok) continue;
    const dead = deadTokens(
      batch.map((m) => m.to as string),
      await res.json().catch(() => null),
    );
    if (dead.length) await admin.from('push_tokens').delete().in('token', dead);
  }

  return new Response(null, { status: 200 });
});
