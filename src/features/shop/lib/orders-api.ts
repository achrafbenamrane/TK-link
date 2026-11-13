import { z } from 'zod';

import { callEdge } from '@/shared/lib/edge';
import { isSupabaseConfigured } from '@/shared/lib/env';
import { supabase } from '@/shared/lib/supabase';

import type { Order } from '../model/schema';
import { FULFILMENTS, type Fulfilment, ORDER_STATUSES, type OrderStatus } from './order-status';

/**
 * LA COMMANDE SUR LE SERVEUR — table `flash_orders` (migration 0012), paiement Stripe Checkout et
 * livraison Uber Direct (fonctions Edge). Rapport d’avancement du 13/11/2026.
 *
 * Le téléphone envoie des identifiants d’offres et des quantités, JAMAIS un prix : le serveur
 * réserve le stock sous verrou, calcule le total et la commission. Les commandes relues sont
 * converties au type `Order` que les écrans affichent déjà ; elles portent `managed: true` (aucune
 * horloge de démonstration ne les fait avancer) et leur suivi vient du serveur.
 */

export type OrdersError =
  | 'not_configured'
  | 'not_signed_in'
  /** Plus assez de pièces (un autre client a été plus rapide). */
  | 'out_of_stock'
  /** L’offre est terminée, retirée, ou son commerce n’est plus validé. */
  | 'offer_unavailable'
  /** Le mode de remise choisi n’est pas proposé par cette offre. */
  | 'mode_unavailable'
  /** Le panier mêle plusieurs commerces : une commande par commerce. */
  | 'one_shop_per_order'
  /** Trois réservations non payées en même temps. */
  | 'too_many_pending'
  | 'address_required'
  /** Livraison : Uber Direct ne livre pas cette adresse (hors zone, trop loin). */
  | 'delivery_unavailable'
  /** Livraison : le numéro du client manque pour le coursier. */
  | 'phone_required'
  /** Livraison : le commerce n’a pas de numéro de téléphone, Uber Direct l’exige. */
  | 'shop_phone_missing'
  /** Le commerce n’a pas encore activé l’encaissement en ligne (Stripe). */
  | 'shop_cannot_be_paid'
  /** Le paiement ou la livraison ne sont pas encore activés sur le serveur. */
  | 'service_unavailable'
  | 'reservation_expired'
  | 'not_your_order'
  | 'invalid_transition'
  | 'pickup_refused'
  /** Le coursier a déjà pris le colis : la course ne s’annule plus depuis l’app. */
  | 'courier_not_cancellable'
  /** Uber a refusé l’annulation (le coursier vient de prendre le colis…). */
  | 'cancel_refused'
  /** La page de paiement Stripe est ouverte : l’annulation passe par le serveur (0020). */
  | 'checkout_open'
  /** Le paiement vient d’aboutir : la commande est payée, elle ne s’annule plus. */
  | 'already_paid'
  /** La réservation ne s’annule plus (déjà annulée, payée, ou expirée). */
  | 'not_cancellable'
  | 'network'
  | 'unknown';

type Result<T> = { ok: true; value: T } | { ok: false; code: OrdersError };

const KNOWN: readonly OrdersError[] = [
  'out_of_stock',
  'offer_unavailable',
  'mode_unavailable',
  'one_shop_per_order',
  'too_many_pending',
  'address_required',
  'delivery_unavailable',
  'phone_required',
  'shop_cannot_be_paid',
  'shop_phone_missing',
  'reservation_expired',
  'not_your_order',
  'invalid_transition',
  'pickup_refused',
  'courier_not_cancellable',
  'not_cancellable',
  'cancel_refused',
  'checkout_open',
  'already_paid',
];

/** Une erreur PostgREST (motif levé par la fonction SQL) ou un code de fonction Edge. */
export function classifyOrdersError(error: unknown): OrdersError {
  if (typeof error === 'string') {
    if ((KNOWN as readonly string[]).includes(error)) return error as OrdersError;
    if (/not_configured$/.test(error) || error === 'uber_unreachable') return 'service_unavailable';
    if (error === 'unauthorized') return 'not_signed_in';
    if (error === 'offline') return 'network';
    if (error === 'order_not_found') return 'not_your_order';
    return 'unknown';
  }
  const e = error as { code?: string; message?: string } | null | undefined;
  const message = String(e?.message ?? error ?? '');
  const motif = KNOWN.find((k) => message.includes(k));
  if (motif) return motif;
  if (/not_authenticated/.test(message)) return 'not_signed_in';
  if (e?.code === 'PGRST202' || e?.code === 'PGRST205' || e?.code === '42883') {
    return 'service_unavailable';
  }
  if (/network|failed to fetch|fetch failed|timed? ?out/i.test(message)) return 'network';
  return 'unknown';
}

// ─────────────────────────────────────────────────────────────── lecture et conversion

const ServerOrderSchema = z.object({
  id: z.string(),
  shop_id: z.string(),
  fulfilment: z.enum(FULFILMENTS),
  status: z.enum(ORDER_STATUSES),
  subtotal_cents: z.number().int(),
  discount_cents: z.number().int(),
  delivery_fee_cents: z.number().int(),
  total_cents: z.number().int(),
  delivery_address: z.string().nullable(),
  delivery_lat: z.number().nullable(),
  delivery_lng: z.number().nullable(),
  reserved_until: z.string(),
  uber_tracking_url: z.string().nullable(),
  uber_status: z.string().nullable().default(null),
  created_at: z.string(),
  flash_order_items: z
    .array(
      z.object({
        offer_id: z.string(),
        title: z.string(),
        qty: z.number().int().positive(),
        unit_price_cents: z.number().int(),
      }),
    )
    .default([]),
});
type ServerOrderRow = z.infer<typeof ServerOrderSchema>;

/** Une commande du serveur, et ce qui n’entre pas dans le type `Order` des écrans. */
export type ServerOrder = Order & {
  shopId: string;
  /** Fin de la réservation tant qu’elle n’est pas payée (ms). */
  reservedUntil: number;
  /** Lien de suivi de la course Uber Direct, une fois commandée. */
  trackingUrl: string | null;
  /**
   * Où en est la course Uber Direct (`pending`, `pickup`, `pickup_complete`…), `null` sans course
   * active — jamais commandée, ou annulée par le commerçant.
   */
  uberStatus: string | null;
  deliveryAddress: string | null;
};

const ORDER_COLUMNS =
  'id, shop_id, fulfilment, status, subtotal_cents, discount_cents, delivery_fee_cents, total_cents, ' +
  'delivery_address, delivery_lat, delivery_lng, reserved_until, uber_tracking_url, uber_status, ' +
  'created_at, ' +
  'flash_order_items(offer_id, title, qty, unit_price_cents)';

/** Pas d’emoji par article sur le serveur : celui de l’offre si on la connaît, sinon un sac. */
export function toServerOrder(
  row: ServerOrderRow,
  emojiOf: (offerId: string) => string,
): ServerOrder {
  const itemsTotal = (row.subtotal_cents - row.discount_cents) / 100;
  return {
    id: row.id,
    createdAt: Date.parse(row.created_at),
    addressId: null,
    ...(row.delivery_lat !== null && row.delivery_lng !== null
      ? { position: { lat: row.delivery_lat, lng: row.delivery_lng } }
      : {}),
    items: row.flash_order_items.map((i) => ({
      dealId: i.offer_id,
      title: i.title,
      emoji: emojiOf(i.offer_id),
      qty: i.qty,
      price: i.unit_price_cents / 100,
    })),
    total: itemsTotal,
    discount: row.discount_cents / 100,
    deliveryFee: row.delivery_fee_cents / 100,
    // Le serveur fait avancer la commande : l’horloge de démonstration ne la touche pas.
    managed: true,
    fulfilment: row.fulfilment,
    status: row.status,
    // 1 € payé (articles, hors livraison) = 1 point, comme les commandes locales.
    pointsEarned: Math.round(itemsTotal),
    rating: null,
    issue: null,
    shopId: row.shop_id,
    reservedUntil: Date.parse(row.reserved_until),
    trackingUrl: row.uber_tracking_url,
    uberStatus: row.uber_status,
    deliveryAddress: row.delivery_address,
  };
}

function parseOrders(rows: unknown, emojiOf: (offerId: string) => string): ServerOrder[] {
  return (Array.isArray(rows) ? rows : []).flatMap((r) => {
    const parsed = ServerOrderSchema.safeParse(r);
    return parsed.success ? [toServerOrder(parsed.data, emojiOf)] : [];
  });
}

async function userId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** Mes commandes (acheteur), la plus récente d’abord. Les réservations abandonnées n’y sont pas. */
export async function fetchMyOrders(
  emojiOf: (offerId: string) => string,
): Promise<Result<ServerOrder[]>> {
  if (!isSupabaseConfigured) return { ok: false, code: 'not_configured' };
  try {
    const uid = await userId();
    if (!uid) return { ok: false, code: 'not_signed_in' };
    const { data, error } = await supabase
      .from('flash_orders')
      .select(ORDER_COLUMNS)
      .eq('customer_id', uid)
      .neq('status', 'annulee')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) return { ok: false, code: classifyOrdersError(error) };
    return { ok: true, value: parseOrders(data, emojiOf) };
  } catch (error) {
    return { ok: false, code: classifyOrdersError(error) };
  }
}

/**
 * Les commandes reçues par le commerce de la personne connectée. Seules les commandes PAYÉES
 * existent pour le commerçant (le paiement vaut acceptation, CDC V1.1) : une réservation en
 * attente de paiement ou abandonnée ne le concerne pas.
 */
export async function fetchShopOrders(
  emojiOf: (offerId: string) => string,
): Promise<Result<ServerOrder[]>> {
  if (!isSupabaseConfigured) return { ok: false, code: 'not_configured' };
  try {
    const uid = await userId();
    if (!uid) return { ok: false, code: 'not_signed_in' };
    const shop = await supabase.from('shops').select('id').eq('owner_id', uid).maybeSingle();
    if (shop.error) return { ok: false, code: classifyOrdersError(shop.error) };
    if (!shop.data) return { ok: true, value: [] };
    const { data, error } = await supabase
      .from('flash_orders')
      .select(ORDER_COLUMNS)
      .eq('shop_id', (shop.data as { id: string }).id)
      .not('status', 'in', '(paiement_attente,annulee)')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return { ok: false, code: classifyOrdersError(error) };
    return { ok: true, value: parseOrders(data, emojiOf) };
  } catch (error) {
    return { ok: false, code: classifyOrdersError(error) };
  }
}

// ─────────────────────────────────────────────────────────────── l’acheteur

export type ReserveInput = {
  lines: { offerId: string; qty: number }[];
  fulfilment: Fulfilment;
  /** Livraison : l’adresse en une ligne, et le point exact s’il est connu. */
  address?: string | null;
  coord?: { lat: number; lng: number } | null;
};

/** Réserve le stock et crée la commande (non payée). Rend son identifiant. */
export async function reserveOrder(input: ReserveInput): Promise<Result<string>> {
  if (!isSupabaseConfigured) return { ok: false, code: 'not_configured' };
  try {
    const { data, error } = await supabase.rpc('reserve_flash', {
      p_items: input.lines.map((l) => ({ offer_id: l.offerId, qty: l.qty })),
      p_fulfilment: input.fulfilment,
      p_address: input.fulfilment === 'livraison' ? (input.address ?? null) : null,
      p_lat: input.fulfilment === 'livraison' ? (input.coord?.lat ?? null) : null,
      p_lng: input.fulfilment === 'livraison' ? (input.coord?.lng ?? null) : null,
    });
    if (error) return { ok: false, code: classifyOrdersError(error) };
    return typeof data === 'string' ? { ok: true, value: data } : { ok: false, code: 'unknown' };
  } catch (error) {
    return { ok: false, code: classifyOrdersError(error) };
  }
}

/** Annule une réservation pas encore payée : le stock revient. */
export async function cancelOrder(orderId: string): Promise<Result<null>> {
  try {
    const { error } = await supabase.rpc('cancel_order', { p_order: orderId });
    if (!error) return { ok: true, value: null };
    const code = classifyOrdersError(error);
    // Une page de paiement est ouverte (0020) : le serveur la fait d’abord expirer chez Stripe, puis
    // annule — sinon on pourrait encore y payer une réservation annulée.
    if (code !== 'checkout_open') return { ok: false, code };
    const res = await callEdge<unknown>('order-cancel', { orderId });
    return res.ok ? { ok: true, value: null } : { ok: false, code: classifyOrdersError(res.code) };
  } catch (error) {
    return { ok: false, code: classifyOrdersError(error) };
  }
}

/** Livraison : le prix demandé à Uber Direct, ajouté au total de la commande. */
export async function quoteDelivery(
  orderId: string,
): Promise<Result<{ feeCents: number; totalCents: number; etaMinutes: number | null }>> {
  const res = await callEdge<{ feeCents?: unknown; totalCents?: unknown; etaMinutes?: unknown }>(
    'uber-quote',
    { orderId },
  );
  if (!res.ok) return { ok: false, code: classifyOrdersError(res.code) };
  const { feeCents, totalCents, etaMinutes } = res.data ?? {};
  if (typeof feeCents !== 'number' || typeof totalCents !== 'number') {
    return { ok: false, code: 'unknown' };
  }
  return {
    ok: true,
    value: { feeCents, totalCents, etaMinutes: typeof etaMinutes === 'number' ? etaMinutes : null },
  };
}

/** L’adresse de la page de paiement Stripe Checkout de la commande. */
export async function startPayment(orderId: string): Promise<Result<string>> {
  const res = await callEdge<{ url?: unknown }>('stripe-payment', { orderId });
  if (!res.ok) return { ok: false, code: classifyOrdersError(res.code) };
  const url = res.data?.url;
  return typeof url === 'string' && url.startsWith('https://')
    ? { ok: true, value: url }
    : { ok: false, code: 'unknown' };
}

/** Le code de retrait (Touch & Collect), lisible par l’acheteur une fois payé. */
export async function fetchPickupCode(orderId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('order_pickup_code', { p_order: orderId });
    return !error && typeof data === 'string' && /^\d{6}$/.test(data) ? data : null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────── le commerçant

/** Payée → en préparation → prête (Touch & Collect ; une livraison passe par `dispatchCourier`). */
export async function advanceOrder(
  orderId: string,
  status: Extract<OrderStatus, 'preparation' | 'prete'>,
): Promise<Result<null>> {
  try {
    const { error } = await supabase.rpc('advance_order', { p_order: orderId, p_status: status });
    return error ? { ok: false, code: classifyOrdersError(error) } : { ok: true, value: null };
  } catch (error) {
    return { ok: false, code: classifyOrdersError(error) };
  }
}

/** Livraison prête : commande la course Uber Direct (une seule par commande). */
export async function dispatchCourier(orderId: string): Promise<Result<string | null>> {
  const res = await callEdge<{ trackingUrl?: unknown }>('uber-dispatch', { orderId });
  if (!res.ok) return { ok: false, code: classifyOrdersError(res.code) };
  const url = res.data?.trackingUrl;
  return { ok: true, value: typeof url === 'string' ? url : null };
}

/**
 * Annule la course Uber Direct tant que le coursier n’a pas pris le colis (fonction `uber-cancel`).
 * La commande reste « prête » : on peut rappeler un coursier.
 */
export async function cancelCourier(orderId: string): Promise<Result<null>> {
  const res = await callEdge<unknown>('uber-cancel', { orderId });
  return res.ok ? { ok: true, value: null } : { ok: false, code: classifyOrdersError(res.code) };
}

/** Touch & Collect : le commerçant valide le code (QR) du client — la commande est remise. */
export async function confirmPickup(orderId: string, code: string): Promise<Result<null>> {
  try {
    const { error } = await supabase.rpc('confirm_pickup', {
      p_order: orderId,
      p_code: code.trim(),
    });
    return error ? { ok: false, code: classifyOrdersError(error) } : { ok: true, value: null };
  } catch (error) {
    return { ok: false, code: classifyOrdersError(error) };
  }
}
