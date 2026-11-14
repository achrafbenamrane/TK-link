// Le prix de la livraison d'une commande réservée, demandé à Uber Direct — appelé par l'ACHETEUR,
// entre la réservation (`reserve_flash`) et le paiement.
//
// Uber Direct remplace les livreurs TK LINK (décision du 13/11/2026). Le devis fixe les frais de
// livraison de la commande (`delivery_fee_cents`, donc son total) ; la course elle-même n'est
// commandée que lorsque le commerçant a préparé la commande (`uber-dispatch`).
//
// Sécurité : l'appelant est identifié par son jeton ; la commande doit être la SIENNE, en livraison,
// pas encore payée. Le prix vient d'Uber, jamais du téléphone.
import { adminClient, callerOf, CORS, jsonBody, reply, serve, UUID } from '../_shared/http.ts';
import { uberConfigured, uberRequest } from '../_shared/uber-api.ts';
import { needsCourier, parseQuote, uberAddress, uberPhone } from '../_shared/uber.ts';

// Numéro de TK LINK, donné à Uber quand le commerce n'a pas renseigné le sien (secret facultatif).
const FALLBACK_PHONE = Deno.env.get('UBER_FALLBACK_PHONE') ?? '';

serve(async (req) => {
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
      'id, customer_id, shop_id, fulfilment, audience, status, subtotal_cents, delivery_address, delivery_lat, delivery_lng, delivery_phone, stripe_payment_intent_id',
    )
    .eq('id', orderId)
    .maybeSingle();
  if (!order || order.customer_id !== user.id) return reply(404, { error: 'order_not_found' });
  // Une offre pro (0023) est livrée par le grossiste : pas de coursier.
  if (!needsCourier(order)) {
    return reply(409, { error: 'not_a_delivery' });
  }
  if (order.status !== 'paiement_attente' || order.stripe_payment_intent_id) {
    return reply(409, { error: 'order_locked' });
  }

  const { data: shop } = await admin
    .from('shops')
    .select('name, address, lat, lng, owner_id')
    .eq('id', order.shop_id)
    .maybeSingle();
  if (!shop) return reply(404, { error: 'shop_not_found' });

  const { data: owner } = await admin
    .from('profiles')
    .select('contact_phone')
    .eq('id', shop.owner_id)
    .maybeSingle();
  const { data: buyer } = await admin
    .from('profiles')
    .select('contact_phone')
    .eq('id', user.id)
    .maybeSingle();

  const pickupPhone = uberPhone(owner?.contact_phone) ?? uberPhone(FALLBACK_PHONE);
  const dropoffPhone =
    uberPhone(order.delivery_phone) ??
    uberPhone(buyer?.contact_phone) ??
    uberPhone(user.phone ? `+${user.phone}` : null);
  if (!dropoffPhone) return reply(422, { error: 'phone_required' });
  if (!pickupPhone) return reply(422, { error: 'shop_phone_missing' });

  const quote = await uberRequest('POST', 'delivery_quotes', {
    pickup_address: uberAddress(shop.address),
    dropoff_address: uberAddress(order.delivery_address ?? ''),
    ...(shop.lat !== null && shop.lng !== null
      ? { pickup_latitude: shop.lat, pickup_longitude: shop.lng }
      : {}),
    ...(order.delivery_lat !== null && order.delivery_lng !== null
      ? { dropoff_latitude: order.delivery_lat, dropoff_longitude: order.delivery_lng }
      : {}),
    pickup_phone_number: pickupPhone,
    dropoff_phone_number: dropoffPhone,
    manifest_total_value: order.subtotal_cents,
    external_store_id: order.shop_id,
  }).catch(() => null);

  if (!quote) return reply(502, { error: 'uber_unreachable' });
  // 400 d'Uber : adresse hors zone, distance trop grande, etc. — à dire au client, pas à cacher.
  if (quote.status >= 400 && quote.status < 500) {
    const code = (quote.body as { code?: string } | null)?.code ?? 'uber_refused';
    return reply(422, { error: 'delivery_unavailable', reason: code });
  }
  const parsed = parseQuote(quote.body, Date.now());
  if (!parsed) return reply(502, { error: 'uber_bad_response' });

  // Le total est une colonne calculée par la base (sous-total − réduction + livraison).
  const { data: updated, error } = await admin
    .from('flash_orders')
    .update({
      uber_quote_id: parsed.id,
      delivery_fee_cents: parsed.feeCents,
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id)
    .eq('status', 'paiement_attente')
    .select('total_cents')
    .maybeSingle();
  if (error || !updated) return reply(409, { error: 'order_locked' });

  return reply(200, {
    feeCents: parsed.feeCents,
    totalCents: updated.total_cents,
    etaMinutes: parsed.etaMinutes,
  });
});
