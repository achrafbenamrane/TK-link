// Les nouvelles d'une course, envoyées par Uber Direct (« event.delivery_status ») : la commande
// passe « en livraison », « livrée », ou en « litige » si la course échoue après paiement.
//
// Sécurité : pas de jeton Supabase ici (Uber ne sait pas en produire, `verify_jwt = false` dans
// supabase/config.toml). La requête est authentifiée par sa SIGNATURE : HMAC-SHA256 du corps brut
// avec la clé de signature du compte (secret `UBER_WEBHOOK_SIGNING_KEY`). Sans elle, rien n'est lu.
// La course est retrouvée par son identifiant Uber ET l'identifiant de commande qu'on lui a donné.
// Un statut final (livrée, litige, remboursée…) n'est jamais réécrit.
import { adminClient } from '../_shared/http.ts';
import {
  orderStatusFor,
  parseWebhook,
  verifyUberSignature,
  WEBHOOK_UPDATABLE,
} from '../_shared/uber.ts';

const SIGNING_KEY = Deno.env.get('UBER_WEBHOOK_SIGNING_KEY') ?? '';

const ok = () => new Response(null, { status: 200 });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response(null, { status: 405 });

  const raw = await req.text();
  const signature = req.headers.get('x-uber-signature') ?? req.headers.get('x-postmates-signature');
  if (!(await verifyUberSignature(raw, signature, SIGNING_KEY))) {
    return new Response(null, { status: 401 });
  }

  let event;
  try {
    event = parseWebhook(JSON.parse(raw));
  } catch {
    return new Response(null, { status: 400 });
  }
  // Autre événement (position du coursier…) : accusé de réception, rien à faire.
  if (!event) return ok();

  const admin = adminClient();
  const next = orderStatusFor(event.status);
  const update: Record<string, unknown> = {
    uber_status: event.status,
    updated_at: new Date().toISOString(),
    ...(event.trackingUrl ? { uber_tracking_url: event.trackingUrl } : {}),
    ...(next ? { status: next } : {}),
  };

  let query = admin
    .from('flash_orders')
    .update(update)
    .eq('uber_delivery_id', event.deliveryId)
    .in('status', WEBHOOK_UPDATABLE);
  if (event.orderId) query = query.eq('id', event.orderId);
  // Une annulation demandée par le commerçant (`uber-cancel`, statut « cancelling ») n'est pas un
  // échec de livraison : son « canceled » ne met pas la commande en litige.
  if (event.status === 'canceled') {
    query = query.or('uber_status.is.null,uber_status.neq.cancelling');
  }
  const { error } = await query;

  // Une erreur de base : Uber renverra l'événement (réponse non 2xx).
  return error ? new Response(null, { status: 500 }) : ok();
});
