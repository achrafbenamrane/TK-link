import { z } from 'zod';

import { supabase } from '@/shared/lib/supabase';

import type { PublishedOffer } from '../model/schema';
import { type FlashApiError, myValidatedShop, OFFER_COLUMNS, ServerOfferSchema } from './flash-api';
import { classifyShopError } from './shop-api';
import { B2B_STATUSES, type B2bStatus } from './wholesale-orders';

/**
 * LE B2B SUR LE SERVEUR (migration 0023) — CDC V1.1 §1 et §2.
 *
 * Le commerçant voit les offres pro des grossistes (lecture réservée aux professionnels, 0011), les
 * commande et les paie comme un client paie un Flash ; le grossiste voit ses ventes et les fait
 * avancer. Le paiement lui-même passe par la caisse de la feature `shop`, branchée par la route.
 */

export type WholesaleApiError = FlashApiError;

type Result<T> = { ok: true; value: T } | { ok: false; code: WholesaleApiError };

const fail = (error: unknown): { ok: false; code: WholesaleApiError } => ({
  ok: false,
  code: classifyShopError(error),
});

// ─────────────────────────────────────────────────────────────── le marché

const LotRowSchema = z.object({
  shops: z.object({ name: z.string(), owner_id: z.string() }),
});

/**
 * Les offres pro en ligne, avec le nom du grossiste, hors les siennes (le serveur refuse de commander
 * sa propre offre). Les plus proches de leur fin d'abord.
 */
export async function fetchServerLots(nowMs: number): Promise<Result<PublishedOffer[]>> {
  try {
    const { data: auth } = await supabase.auth.getSession();
    const uid = auth.session?.user.id;
    if (!uid) return { ok: false, code: 'not_signed_in' };
    const nowIso = new Date(nowMs).toISOString();
    const { data, error } = await supabase
      .from('flash_offers')
      .select(`${OFFER_COLUMNS}, shops!inner(name, owner_id)`)
      .eq('audience', 'commercants')
      .eq('offline', false)
      .lte('starts_at', nowIso)
      .gt('ends_at', nowIso)
      .order('ends_at', { ascending: true })
      .limit(100);
    if (error) return fail(error);
    const lots: PublishedOffer[] = [];
    for (const row of data ?? []) {
      const offer = ServerOfferSchema.safeParse(row);
      const shop = LotRowSchema.safeParse(row);
      if (!offer.success || !shop.success) return { ok: false, code: 'unknown' };
      if (shop.data.shops.owner_id === uid) continue;
      lots.push({ ...offer.data, seller: shop.data.shops.name });
    }
    return { ok: true, value: lots };
  } catch (error) {
    return fail(error);
  }
}

// ───────────────────────────────────────────────────── les commandes B2B

export type B2bOrder = {
  id: string;
  status: B2bStatus;
  fulfilment: 'touch-collect' | 'livraison';
  /** Le titre de l'offre (et « + n » s'il y en avait plusieurs). */
  title: string;
  qty: number;
  totalCents: number;
  /** Le grossiste (vu par l'acheteur) ou le commerce acheteur (vu par le grossiste). */
  counterpart: string;
  address: string | null;
  at: number;
};

const OrderRowSchema = z.object({
  id: z.string(),
  customer_id: z.string(),
  status: z.enum(B2B_STATUSES),
  fulfilment: z.enum(['touch-collect', 'livraison']),
  total_cents: z.number().int(),
  delivery_address: z.string().nullable(),
  created_at: z.string(),
  shops: z.object({ name: z.string() }).nullable(),
  flash_order_items: z.array(
    z.object({ title: z.string(), qty: z.number().int(), unit_price_cents: z.number().int() }),
  ),
});
type OrderRow = z.infer<typeof OrderRowSchema>;

const ORDER_COLUMNS =
  'id, customer_id, status, fulfilment, total_cents, delivery_address, created_at, ' +
  'shops(name), flash_order_items(title, qty, unit_price_cents)';

function toOrder(row: OrderRow, counterpart: string): B2bOrder {
  const [first, ...rest] = row.flash_order_items;
  return {
    id: row.id,
    status: row.status,
    fulfilment: row.fulfilment,
    title: first ? `${first.title}${rest.length > 0 ? ` + ${rest.length}` : ''}` : 'Commande',
    qty: row.flash_order_items.reduce((sum, i) => sum + i.qty, 0),
    totalCents: row.total_cents,
    counterpart,
    address: row.delivery_address,
    at: Date.parse(row.created_at),
  };
}

/** Mes achats aux grossistes : le plus récent d'abord, réservations à payer comprises. */
export async function fetchB2bPurchases(): Promise<Result<B2bOrder[]>> {
  try {
    const { data: auth } = await supabase.auth.getSession();
    const uid = auth.session?.user.id;
    if (!uid) return { ok: false, code: 'not_signed_in' };
    const { data, error } = await supabase
      .from('flash_orders')
      .select(ORDER_COLUMNS)
      .eq('audience', 'commercants')
      .eq('customer_id', uid)
      .neq('status', 'annulee')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return fail(error);
    const rows = z.array(OrderRowSchema).safeParse(data);
    if (!rows.success) return { ok: false, code: 'unknown' };
    return { ok: true, value: rows.data.map((r) => toOrder(r, r.shops?.name ?? 'Grossiste')) };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Les ventes de mon entreprise aux commerçants — payées seulement : une réservation qui attend son
 * paiement n'est pas encore une commande à préparer. Avec le nom du commerce acheteur (public : il
 * est validé, sinon il n'aurait pas pu commander).
 */
export async function fetchB2bSales(): Promise<Result<B2bOrder[]>> {
  try {
    const shop = await myValidatedShop();
    if (!shop.ok) return shop.code === 'not_validated' ? { ok: true, value: [] } : shop;
    const { data, error } = await supabase
      .from('flash_orders')
      .select(ORDER_COLUMNS)
      .eq('audience', 'commercants')
      .eq('shop_id', shop.value.id)
      .not('status', 'in', '(paiement_attente,annulee)')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return fail(error);
    const rows = z.array(OrderRowSchema).safeParse(data);
    if (!rows.success) return { ok: false, code: 'unknown' };

    const buyerIds = [...new Set(rows.data.map((r) => r.customer_id))];
    const names = new Map<string, string>();
    if (buyerIds.length > 0) {
      const { data: buyers } = await supabase
        .from('shops')
        .select('owner_id, name')
        .in('owner_id', buyerIds);
      const parsed = z
        .array(z.object({ owner_id: z.string(), name: z.string() }))
        .safeParse(buyers);
      if (parsed.success) for (const b of parsed.data) names.set(b.owner_id, b.name);
    }
    return {
      ok: true,
      value: rows.data.map((r) => toOrder(r, names.get(r.customer_id) ?? 'Commerçant')),
    };
  } catch (error) {
    return fail(error);
  }
}

/** Le grossiste fait avancer une vente (le serveur n'accepte que l'étape suivante). */
export async function advanceB2bOrder(
  orderId: string,
  status: 'preparation' | 'prete' | 'en_livraison' | 'livree',
): Promise<Result<null>> {
  try {
    const { error } = await supabase.rpc('advance_order', { p_order: orderId, p_status: status });
    return error ? fail(error) : { ok: true, value: null };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Retrait chez le grossiste : il remet la commande contre le code à six chiffres de l'acheteur (le
 * même contrôle que le comptoir d'un commerçant, `confirm_pickup`).
 */
export async function confirmB2bPickup(orderId: string, code: string): Promise<Result<null>> {
  try {
    const { error } = await supabase.rpc('confirm_pickup', { p_order: orderId, p_code: code });
    if (!error) return { ok: true, value: null };
    return String(error.message ?? '').includes('pickup_refused')
      ? { ok: false, code: 'invalid' }
      : fail(error);
  } catch (error) {
    return fail(error);
  }
}
