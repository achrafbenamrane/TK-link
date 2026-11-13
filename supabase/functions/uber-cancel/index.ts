// Annule la course Uber Direct d'une commande — appelé par le COMMERÇANT, tant que le coursier n'a
// pas pris le colis (adresse erronée, client qui préfère passer, coursier qui tarde…). La commande
// reste « prête » : le commerçant peut rappeler un coursier.
//
// L'ordre compte (relecture du 13/11/2026) : on PREND d'abord la commande en base
// (`uber_status = 'cancelling'`, sous condition), puis on appelle Uber. Le webhook Uber ignore un
// « canceled » pour une commande en cours d'annulation — sans cela, l'événement pouvait arriver entre
// l'appel à Uber et l'écriture en base, et mettre la commande en « litige ». Uber refuse : on remet la
// course telle qu'elle était. Uber accepte : on efface la course (identifiant, suivi, statut).
//
// Sécurité : l'appelant est identifié par son jeton et doit être le titulaire du commerce.
import { adminClient, callerOf, CORS, jsonBody, reply, UUID } from '../_shared/http.ts';
import { uberConfigured, uberRequest } from '../_shared/uber-api.ts';
import { CANCELLABLE_UBER_STATUSES, isCourierCancellable } from '../_shared/uber.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
  if (!uberConfigured()) return reply(503, { error: 'uber_not_configured' });

  const user = await callerOf(req);
  if (!user) return reply(401, { error: 'unauthorized' });

  const orderId = (await jsonBody(req))?.orderId;
  if (typeof orderId !== 'string' || !UUID.test(orderId))
    return reply(400, { error: 'invalid_order' });

  const admin = adminClient();
  const { data: order, error: readError } = await admin
    .from('flash_orders')
    .select('id, shop_id, status, uber_delivery_id, uber_status')
    .eq('id', orderId)
    .maybeSingle();
  if (readError) return reply(500, { error: 'server_error' });
  if (!order) return reply(404, { error: 'order_not_found' });
  const { data: shop } = await admin
    .from('shops')
    .select('owner_id')
    .eq('id', order.shop_id)
    .maybeSingle();
  if (!shop || shop.owner_id !== user.id) return reply(404, { error: 'order_not_found' });
  if (!isCourierCancellable(order)) return reply(409, { error: 'courier_not_cancellable' });

  const deliveryId = order.uber_delivery_id as string;
  const before = order.uber_status as string;

  // 1) Prendre la commande : une seule annulation à la fois, et le webhook « canceled » est ignoré.
  const { data: claimed, error: claimError } = await admin
    .from('flash_orders')
    .update({ uber_status: 'cancelling', updated_at: new Date().toISOString() })
    .eq('id', order.id)
    .eq('uber_delivery_id', deliveryId)
    .eq('status', 'prete')
    .in('uber_status', CANCELLABLE_UBER_STATUSES)
    .select('id')
    .maybeSingle();
  if (claimError) return reply(500, { error: 'server_error' });
  if (!claimed) return reply(409, { error: 'courier_not_cancellable' });

  // 2) Uber. Le corps vide `{}` : certains serveurs JSON refusent un POST sans corps.
  const cancelled = await uberRequest(
    'POST',
    `deliveries/${encodeURIComponent(deliveryId)}/cancel`,
    {},
  ).catch(() => null);

  if (!cancelled || cancelled.status >= 300) {
    // 3a) Refus (coursier qui vient de prendre le colis…) : la course redevient ce qu'elle était,
    //     sauf si un événement Uber l'a déjà fait avancer.
    await admin
      .from('flash_orders')
      .update({ uber_status: before, updated_at: new Date().toISOString() })
      .eq('id', order.id)
      .eq('uber_status', 'cancelling');
    return reply(cancelled ? 409 : 502, { error: 'cancel_refused' });
  }

  // 3b) Annulée chez Uber : plus de course. La commande reste « prête », on peut en rappeler une.
  const { data: cleared, error } = await admin
    .from('flash_orders')
    .update({
      uber_delivery_id: null,
      uber_tracking_url: null,
      uber_status: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id)
    .eq('uber_delivery_id', deliveryId)
    .select('id')
    .maybeSingle();
  if (error || !cleared) return reply(500, { error: 'server_error' });

  return reply(200, { cancelled: true });
});
