import { z } from 'zod';

import { CATEGORIES } from '@/shared/lib/categories';
import { supabase } from '@/shared/lib/supabase';

import type { LiveOffer } from '../model/live';

/**
 * Les Flash en ligne, lues sur le serveur (`flash_offers` + le commerce qui les publie).
 *
 * Les règles d'accès ne laissent passer que les Flash d'un commerce VALIDÉ, non retirées et destinées
 * aux clients ; la requête ajoute ce qui dépend de l'heure (commencées, pas terminées) et du stock.
 * Toute la réponse passe par Zod : une colonne renommée échoue ici, pas sur l'écran.
 */

const COLUMNS =
  'id, title, category, description, price_cents, old_price_cents, stock_total, stock_left, ' +
  'ends_at, modes, photo_url, shop:shops!inner(id, name, area, lat, lng)';

const RowSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    category: z.enum(CATEGORIES),
    description: z.string(),
    price_cents: z.number().int(),
    old_price_cents: z.number().int(),
    stock_total: z.number().int(),
    stock_left: z.number().int(),
    ends_at: z.string(),
    modes: z.array(z.enum(['touch-collect', 'livraison'])),
    photo_url: z.string().nullable(),
    shop: z.object({
      id: z.string(),
      name: z.string(),
      area: z.string(),
      lat: z.number().nullable(),
      lng: z.number().nullable(),
    }),
  })
  .transform((r): LiveOffer => ({
    id: r.id,
    shopId: r.shop.id,
    shopName: r.shop.name,
    area: r.shop.area,
    lat: r.shop.lat,
    lng: r.shop.lng,
    category: r.category,
    title: r.title,
    description: r.description,
    priceCents: r.price_cents,
    oldPriceCents: r.old_price_cents,
    stockTotal: r.stock_total,
    stockLeft: r.stock_left,
    endsAt: Date.parse(r.ends_at),
    modes: r.modes,
    photoUrl: r.photo_url ?? '',
    // Complétée par `shop_ratings` (0025) dans le magasin du fil.
    shopRating: 0,
    shopRatingCount: 0,
  }));

export type FeedResult = { ok: true; value: LiveOffer[] } | { ok: false };

/** Les Flash en cours à `nowIso`, celles qui finissent le plus tôt d'abord (c'est un déstockage). */
export async function fetchLiveFlashes(nowIso: string): Promise<FeedResult> {
  try {
    const { data, error } = await supabase
      .from('flash_offers')
      .select(COLUMNS)
      .eq('audience', 'clients')
      .lte('starts_at', nowIso)
      .gt('ends_at', nowIso)
      .gt('stock_left', 0)
      .order('ends_at', { ascending: true })
      .limit(200);
    if (error) return { ok: false };
    const parsed = z.array(RowSchema).safeParse(data);
    return parsed.success ? { ok: true, value: parsed.data } : { ok: false };
  } catch {
    return { ok: false };
  }
}
