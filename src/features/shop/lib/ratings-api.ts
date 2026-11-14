import { z } from 'zod';

import { isSupabaseConfigured } from '@/shared/lib/env';
import { supabase } from '@/shared/lib/supabase';

import { RATING_TAGS, type Rating, type RatingTag } from './rating';

/**
 * NOTER LE COMMERÇANT, SUR LE SERVEUR (migration 0025) — CDC V1.1 (Client, VALIDÉ) : étoiles et tags
 * rapides après une commande terminée, sans texte libre ; la moyenne sur la vitrine.
 *
 * Le serveur seul écrit (`rate_order`) et seul décide qui peut noter quoi. L'app relit sa propre note
 * (règle d'accès : chacun ne voit que les siennes) et les moyennes publiques (`shop_ratings`).
 *
 * Tant que 0025 n'est pas appliquée, tout répond « indisponible » sans casser l'écran : la note
 * ne s'affiche simplement pas.
 */

export type RatingError =
  | 'not_signed_in'
  /** Pas sa commande, ou elle n'existe plus. */
  | 'order_not_found'
  /** Achat B2B : la note est une règle du client final. */
  | 'not_ratable'
  | 'not_finished'
  | 'invalid_rating'
  | 'already_rated'
  /** Le serveur n'a pas (encore) la notation : migration 0025 absente, ou pas de serveur. */
  | 'unavailable'
  | 'network'
  | 'unknown';

type Result<T> = { ok: true; value: T } | { ok: false; code: RatingError };

const MOTIFS: readonly RatingError[] = [
  'order_not_found',
  'not_ratable',
  'not_finished',
  'invalid_rating',
  'already_rated',
];

export function classifyRatingError(error: unknown): RatingError {
  const e = error as { code?: string; message?: string } | null | undefined;
  const message = String(e?.message ?? error ?? '');
  if (/not_authenticated/.test(message)) return 'not_signed_in';
  const motif = MOTIFS.find((m) => message.includes(m));
  if (motif) return motif;
  if (
    e?.code === 'PGRST202' ||
    e?.code === 'PGRST205' ||
    e?.code === '42883' ||
    e?.code === '42P01'
  ) {
    return 'unavailable';
  }
  if (/network|failed to fetch|fetch failed|timed? ?out/i.test(message)) return 'network';
  return 'unknown';
}

export const RATING_ERROR: Record<RatingError, string> = {
  not_signed_in: 'Connectez-vous pour noter ce commerce.',
  order_not_found: 'Cette commande n’est pas la vôtre.',
  not_ratable: 'Un achat aux grossistes ne se note pas.',
  not_finished: 'Vous pourrez noter le commerce une fois la commande récupérée ou livrée.',
  invalid_rating: 'Choisissez de 1 à 5 étoiles.',
  already_rated: 'Vous avez déjà noté cette commande.',
  unavailable: 'La notation n’est pas encore ouverte. Réessayez bientôt.',
  network: 'Pas de connexion. Réessayez dans un instant.',
  unknown: 'La note n’a pas pu être envoyée. Réessayez.',
};

/** Envoie la note d'une commande du serveur. */
export async function rateServerOrder(
  orderId: string,
  stars: number,
  tags: RatingTag[],
): Promise<Result<null>> {
  if (!isSupabaseConfigured) return { ok: false, code: 'unavailable' };
  try {
    const { error } = await supabase.rpc('rate_order', {
      p_order: orderId,
      p_stars: stars,
      p_tags: tags,
    });
    return error ? { ok: false, code: classifyRatingError(error) } : { ok: true, value: null };
  } catch (error) {
    return { ok: false, code: classifyRatingError(error) };
  }
}

const RatingRowSchema = z.object({
  stars: z.number().int().min(1).max(5),
  tags: z.array(z.enum(RATING_TAGS)).catch([]),
  created_at: z.string(),
});

/** Sa propre note pour cette commande (null : pas encore notée). */
export async function fetchMyRating(orderId: string): Promise<Result<Rating | null>> {
  if (!isSupabaseConfigured) return { ok: false, code: 'unavailable' };
  try {
    const { data, error } = await supabase
      .from('order_ratings')
      .select('stars, tags, created_at')
      .eq('order_id', orderId)
      .maybeSingle();
    if (error) return { ok: false, code: classifyRatingError(error) };
    if (!data) return { ok: true, value: null };
    const row = RatingRowSchema.safeParse(data);
    if (!row.success) return { ok: false, code: 'unknown' };
    return {
      ok: true,
      value: { stars: row.data.stars, tags: row.data.tags, at: Date.parse(row.data.created_at) },
    };
  } catch (error) {
    return { ok: false, code: classifyRatingError(error) };
  }
}

export type ShopRating = { average: number; count: number };

const SummarySchema = z.array(
  z.object({
    shop_id: z.string(),
    average: z.coerce.number(),
    count: z.number().int(),
  }),
);

/**
 * Les moyennes publiques des commerces demandés. Ne fait jamais échouer l'écran : sans serveur,
 * sans 0025 ou sans réseau, aucune moyenne (et la vitrine dit « Nouveau »).
 */
export async function fetchShopRatings(shopIds: string[]): Promise<Record<string, ShopRating>> {
  const ids = [...new Set(shopIds)];
  if (!isSupabaseConfigured || ids.length === 0) return {};
  try {
    const { data, error } = await supabase.rpc('shop_ratings', { p_shops: ids });
    if (error) return {};
    const rows = SummarySchema.safeParse(data);
    if (!rows.success) return {};
    return Object.fromEntries(
      rows.data.map((r) => [r.shop_id, { average: r.average, count: r.count }]),
    );
  } catch {
    return {};
  }
}
