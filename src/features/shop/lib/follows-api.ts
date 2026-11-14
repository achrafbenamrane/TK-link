import { z } from 'zod';

import { isSupabaseConfigured } from '@/shared/lib/env';
import { supabase } from '@/shared/lib/supabase';

/**
 * SUIVRE UN COMMERCE (migration 0026) — CDC V1.1 (Client, EXIGENCE) « favoris et alertes » ;
 * arbitrage du 14/11/2026 : le cœur d'une vitrine suit le commerce, et sa prochaine vente flash
 * prévient ses abonnés (notification envoyée par la base, voir `push-events`).
 *
 * Les règles d'accès du serveur font le reste : chacun ne lit, n'ajoute et ne retire que ses
 * propres abonnements, et seulement vers un commerce validé.
 */

export type FollowError = 'not_signed_in' | 'unavailable' | 'network' | 'unknown';
type Result<T> = { ok: true; value: T } | { ok: false; code: FollowError };

export type FollowedShop = { shopId: string; name: string; area: string };

export const FOLLOW_ERROR: Record<FollowError, string> = {
  not_signed_in: 'Connectez-vous pour suivre ce commerce.',
  unavailable: 'Le suivi des commerces n’est pas encore ouvert. Réessayez bientôt.',
  network: 'Pas de connexion. Réessayez dans un instant.',
  unknown: 'Le suivi n’a pas pu être enregistré. Réessayez.',
};

export function classifyFollowError(error: unknown): FollowError {
  const e = error as { code?: string; message?: string } | null | undefined;
  const message = String(e?.message ?? error ?? '');
  if (e?.code === 'PGRST205' || e?.code === '42P01') return 'unavailable';
  if (/network|failed to fetch|fetch failed|timed? ?out/i.test(message)) return 'network';
  return 'unknown';
}

const RowSchema = z.object({
  shop_id: z.string(),
  shop: z.object({ name: z.string(), area: z.string().nullable().default('') }).nullable(),
});

/** Ses abonnements, du plus récent au plus ancien. */
export async function fetchFollowedShops(): Promise<Result<FollowedShop[]>> {
  if (!isSupabaseConfigured) return { ok: false, code: 'unavailable' };
  try {
    const { data, error } = await supabase
      .from('shop_follows')
      .select('shop_id, shop:shops(name, area)')
      .order('created_at', { ascending: false });
    if (error) return { ok: false, code: classifyFollowError(error) };
    const rows = z.array(RowSchema).safeParse(data ?? []);
    if (!rows.success) return { ok: false, code: 'unknown' };
    return {
      ok: true,
      value: rows.data.flatMap((r) =>
        r.shop ? [{ shopId: r.shop_id, name: r.shop.name, area: r.shop.area ?? '' }] : [],
      ),
    };
  } catch (error) {
    return { ok: false, code: classifyFollowError(error) };
  }
}

async function myId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function followShop(shopId: string): Promise<Result<null>> {
  if (!isSupabaseConfigured) return { ok: false, code: 'unavailable' };
  try {
    const uid = await myId();
    if (!uid) return { ok: false, code: 'not_signed_in' };
    const { error } = await supabase.from('shop_follows').insert({ user_id: uid, shop_id: shopId });
    // Déjà suivi (un autre téléphone, un double appui) : c'est le résultat voulu.
    if (error && error.code !== '23505') return { ok: false, code: classifyFollowError(error) };
    return { ok: true, value: null };
  } catch (error) {
    return { ok: false, code: classifyFollowError(error) };
  }
}

export async function unfollowShop(shopId: string): Promise<Result<null>> {
  if (!isSupabaseConfigured) return { ok: false, code: 'unavailable' };
  try {
    const { error } = await supabase.from('shop_follows').delete().eq('shop_id', shopId);
    return error ? { ok: false, code: classifyFollowError(error) } : { ok: true, value: null };
  } catch (error) {
    return { ok: false, code: classifyFollowError(error) };
  }
}
