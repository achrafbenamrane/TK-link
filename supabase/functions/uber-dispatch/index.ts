// Commande la course Uber Direct d'une commande payée — appelé par le COMMERÇANT quand la commande
// est prête à partir. La commande passe à « prête » ; la suite (« en livraison », « livrée ») vient
// du webhook Uber (`uber-webhook`), jamais du téléphone.
//
// Sécurité : l'appelant est identifié par son jeton et doit être le titulaire du commerce. Une
// commande ne commande qu'UNE course : la ligne est d'abord « réservée » (`uber_status =
// 'requesting'`, sous condition), si bien que deux appuis simultanés n'en commandent pas deux.
import { adminClient, callerOf, CORS, jsonBody, reply, UUID } from '../_shared/http.ts';
import { uberConfigured, uberRequest } from '../_shared/uber-api.ts';
import { parseDelivery, uberAddress, uberPhone } from '../_shared/uber.ts';

const FALLBACK_PHONE = Deno.env.get('UBER_FALLBACK_PHONE') ?? '';
const DISPATCHABLE = ['payee', 'acceptee', 'preparation', 'prete'];

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
    .select(
      'id, customer_id, shop_id, fulfilment, status, subtotal_cents, delivery_address, delivery_lat, delivery_lng, delivery_phone, uber_delivery_id, uber_tracking_url',
    )
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return reply(404, { error: 'order_not_found' });

  const { data: shop } = await admin
    .from('shops')
    .select('name, address, lat, lng, owner_id')
    .eq('id', order.shop_id)
    .maybeSingle();
  if (!shop || shop.owner_id !== user.id) return reply(404, { error: 'order_not_found' });
  if (order.fulfilment !== 'livraison') return reply(409, { error: 'not_a_delivery' });
  // Déjà commandée (second appui, autre téléphone) : on rend la course existante.
  if (order.uber_delivery_id) {
    return reply(200, { deliveryId: order.uber_delivery_id, trackingUrl: order.uber_tracking_url });
  }
  if (!DISPATCHABLE.includes(order.status)) return reply(409, { error: 'not_paid' });

  // Réserver le droit de commander la course (une seule fois).
  const { data: claimed } = await admin
    .from('flash_orders')
    .update({ uber_status: 'requesting', updated_at: new Date().toISOString() })
    .eq('id', order.id)
    .is('uber_delivery_id', null)
    .or('uber_status.is.null,uber_status.eq.failed')
    .select('id')
    .maybeSingle();
  if (!claimed) return reply(409, { error: 'dispatch_in_progress' });

  const release = () =>
    admin.from('flash_orders').update({ uber_status: 'failed' }).eq('id', order.id);

  const [{ data: owner }, { data: buyer }, { data: items }] = await Promise.all([
    admin.from('profiles').select('contact_phone').eq('id', shop.owner_id).maybeSingle(),
    admin
      .from('profiles')
      .select('first_name, contact_phone')
      .eq('id', order.customer_id)
      .maybeSingle(),
    admin.from('flash_order_items').select('title, qty, unit_price_cents').eq('order_id', order.id),
  ]);

  const pickupPhone = uberPhone(owner?.contact_phone) ?? uberPhone(FALLBACK_PHONE);
  const dropoffPhone = uberPhone(order.delivery_phone) ?? uberPhone(buyer?.contact_phone);
  if (!pickupPhone || !dropoffPhone) {
    await release();
    return reply(422, { error: pickupPhone ? 'phone_required' : 'shop_phone_missing' });
  }

  const created = await uberRequest('POST', 'deliveries', {
    pickup_name: shop.name,
    pickup_address: uberAddress(shop.address),
    pickup_phone_number: pickupPhone,
    ...(shop.lat !== null && shop.lng !== null
      ? { pickup_latitude: shop.lat, pickup_longitude: shop.lng }
      : {}),
    dropoff_name: buyer?.first_name || 'Client TK LINK',
    dropoff_address: uberAddress(order.delivery_address ?? ''),
    dropoff_phone_number: dropoffPhone,
    ...(order.delivery_lat !== null && order.delivery_lng !== null
      ? { dropoff_latitude: order.delivery_lat, dropoff_longitude: order.delivery_lng }
      : {}),
    manifest_items: (items ?? []).map((i) => ({
      name: i.title,
      quantity: i.qty,
      size: 'small',
      price: i.unit_price_cents,
    })),
    manifest_total_value: order.subtotal_cents,
    external_id: order.id,
    external_store_id: order.shop_id,
    // Personne à la porte : le colis revient au commerce plutôt que d'être laissé dehors.
    undeliverable_action: 'return',
  }).catch(() => null);

  const delivery = created && created.status < 300 ? parseDelivery(created.body) : null;
  if (!delivery) {
    await release();
    const code = (created?.body as { code?: string } | null)?.code;
    return reply(created ? 422 : 502, {
      error: 'dispatch_failed',
      ...(code ? { reason: code } : {}),
    });
  }

  const { error } = await admin
    .from('flash_orders')
    .update({
      uber_delivery_id: delivery.id,
      uber_tracking_url: delivery.trackingUrl,
      uber_status: delivery.status,
      status: 'prete',
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id);
  if (error) return reply(500, { error: 'server_error' });

  return reply(200, { deliveryId: delivery.id, trackingUrl: delivery.trackingUrl });
});
