// Annule la course Uber Direct d'une commande — appelé par le COMMERÇANT, tant que le coursier n'a
// pas pris le colis (adresse erronée, client qui préfère passer, coursier qui tarde…). La commande
// reste « prête » : le commerçant peut rappeler un coursier ou la remettre au comptoir.
//
// Le webhook Uber (`uber-webhook`) retrouve une commande par l'identifiant de sa course : on l'efface
// ici, si bien que l'événement « canceled » qu'Uber enverra ensuite ne met pas la commande en
// « litige » — une annulation voulue n'est pas un échec de livraison.
//
// Sécurité : l'appelant est identifié par son jeton et doit être le titulaire du commerce.
import { adminClient, callerOf, CORS, jsonBody, reply, UUID } from '../_shared/http.ts';
import { uberConfigured, uberRequest } from '../_shared/uber-api.ts';
import { isCourierCancellable } from '../_shared/uber.ts';

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
  const { data: order } = await admin
    .from('flash_orders')
    .select('id, shop_id, status, uber_delivery_id, uber_status')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return reply(404, { error: 'order_not_found' });
  const { data: shop } = await admin
    .from('shops')
    .select('owner_id')
    .eq('id', order.shop_id)
    .maybeSingle();
  if (!shop || shop.owner_id !== user.id) return reply(404, { error: 'order_not_found' });
  if (!isCourierCancellable(order)) return reply(409, { error: 'not_cancellable' });

  const deliveryId = order.uber_delivery_id as string;
  const cancelled = await uberRequest(
    'POST',
    `deliveries/${encodeURIComponent(deliveryId)}/cancel`,
  ).catch(() => null);
  // Uber refuse (coursier qui vient de prendre le colis…) : rien ne change ici.
  if (!cancelled || cancelled.status >= 300) {
    return reply(cancelled ? 409 : 502, { error: 'cancel_refused' });
  }

  // Sous condition : si un webhook a fait avancer la course entre-temps, on n'écrase rien.
  const { error } = await admin
    .from('flash_orders')
    .update({
      uber_delivery_id: null,
      uber_tracking_url: null,
      uber_status: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id)
    .eq('uber_delivery_id', deliveryId)
    .eq('status', 'prete');
  if (error) return reply(500, { error: 'server_error' });

  return reply(200, { cancelled: true });
});
