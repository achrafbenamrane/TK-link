// Envoie les notifications : une commande change de statut, TK LINK répond à une demande, un commerce
// suivi publie une vente flash.
//
// Appelée par les déclencheurs de la base (pg_net, migrations 0024 et 0026) :
//   - table `flash_orders`, changement de statut ;
//   - table `support_messages`, réponse de TK LINK ;
//   - table `flash_offers`, Flash client publiée par un commerce suivi ;
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
  followMessage,
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
  let userIds: string[] = [];

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
    if (message?.to === 'customer') userIds = [r.customer_id];
    if (message?.to === 'shop_owner') {
      const { data } = await admin
        .from('shops')
        .select('owner_id')
        .eq('id', r.shop_id)
        .maybeSingle();
      if (data?.owner_id) userIds = [data.owner_id as string];
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
      if (data?.author_id) userIds = [data.author_id as string];
    }
  } else if (payload.table === 'flash_offers') {
    const r = payload.record as {
      id: string;
      shop_id: string;
      title: string;
      audience?: string | null;
      starts_at?: string | null;
    };
    const { data: shop } = await admin
      .from('shops')
      .select('name, owner_id')
      .eq('id', r.shop_id)
      .maybeSingle();
    message = followMessage(r, (shop?.name as string | undefined) ?? '', Date.now());
    if (message) {
      const { data: follows } = await admin
        .from('shop_follows')
        .select('user_id')
        .eq('shop_id', r.shop_id);
      // Le commerçant qui suivrait sa propre vitrine n'est pas prévenu de sa propre publication.
      userIds = (follows ?? [])
        .map((f) => f.user_id as string)
        .filter((id) => id !== shop?.owner_id);
    }
  }
  if (!message || userIds.length === 0) return new Response(null, { status: 200 });

  // Les jetons des destinataires, par paquets (une longue liste ne tient pas dans une adresse).
  const tokens: string[] = [];
  for (let i = 0; i < userIds.length; i += 200) {
    const { data: rows } = await admin
      .from('push_tokens')
      .select('token')
      .in('user_id', userIds.slice(i, i + 200));
    tokens.push(...(rows ?? []).map((row) => row.token as string));
  }

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
