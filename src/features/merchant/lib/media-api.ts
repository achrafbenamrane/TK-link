import { z } from 'zod';

import { callEdge } from '@/shared/lib/edge';
import { supabase } from '@/shared/lib/supabase';

/**
 * LES VISUELS IA DU COMMERCE — table `shop_media` (migration 0015), fonctions Edge `ai-media-start`
 * et `ai-media-status` (fal.ai). Rapport d’avancement du 13/11/2026 : « les commerçants présentent
 * leur boutique sans produire eux-mêmes les visuels ».
 *
 * Le téléphone demande une génération et relève le résultat ; il n’écrit jamais la table. Le quota
 * (10 images, 2 vidéos par jour) est tenu par le serveur.
 */

export const MEDIA_KINDS = ['image', 'video'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];
export const MEDIA_STATUSES = ['en_cours', 'pret', 'echec'] as const;
export type MediaStatus = (typeof MEDIA_STATUSES)[number];

const ShopMediaSchema = z
  .object({
    id: z.string(),
    kind: z.enum(MEDIA_KINDS),
    status: z.enum(MEDIA_STATUSES),
    url: z.string().nullable(),
    visible: z.boolean(),
    brief: z.string(),
    created_at: z.string(),
  })
  .transform(({ created_at, ...m }) => ({ ...m, createdAt: Date.parse(created_at) }));

export type ShopMedia = z.output<typeof ShopMediaSchema>;

export type MediaApiError =
  | 'not_signed_in'
  /** Le commerce n’est pas (encore) validé par TK LINK. */
  | 'shop_not_validated'
  | 'no_shop'
  /** Quota du jour atteint. */
  | 'quota_exhausted'
  /** Le serveur n’a pas sa clé fal.ai (ou pas de serveur du tout). */
  | 'not_configured'
  | 'ai_failed'
  | 'network'
  | 'unknown';

type Result<T> = { ok: true; value: T } | { ok: false; code: MediaApiError };

const COLUMNS = 'id, kind, status, url, visible, brief, created_at';

function edgeCode(code: string): MediaApiError {
  switch (code) {
    case 'shop_not_validated':
    case 'no_shop':
    case 'quota_exhausted':
    case 'ai_failed':
      return code;
    case 'ai_not_configured':
    case 'not_configured':
      return 'not_configured';
    case 'unauthorized':
      return 'not_signed_in';
    case 'offline':
      return 'network';
    default:
      return 'unknown';
  }
}

const parseList = (rows: unknown): ShopMedia[] =>
  (Array.isArray(rows) ? rows : []).flatMap((r) => {
    const parsed = ShopMediaSchema.safeParse(r);
    return parsed.success ? [parsed.data] : [];
  });

/** Les visuels du commerce de la personne connectée, les plus récents d’abord (ratés compris). */
export async function fetchMyMedia(): Promise<Result<ShopMedia[]>> {
  try {
    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user.id;
    if (!userId) return { ok: false, code: 'not_signed_in' };
    const shop = await supabase.from('shops').select('id').eq('owner_id', userId).maybeSingle();
    if (shop.error) return { ok: false, code: 'unknown' };
    if (!shop.data) return { ok: false, code: 'no_shop' };
    const { data, error } = await supabase
      .from('shop_media')
      .select(COLUMNS)
      .eq('shop_id', shop.data.id)
      .order('created_at', { ascending: false });
    if (error) return { ok: false, code: 'unknown' };
    return { ok: true, value: parseList(data) };
  } catch {
    return { ok: false, code: 'network' };
  }
}

/** Les visuels montrés sur la vitrine d’un commerce (lecture publique : prêts et visibles). */
export async function fetchShopMedia(shopId: string): Promise<ShopMedia[]> {
  try {
    const { data, error } = await supabase
      .from('shop_media')
      .select(COLUMNS)
      .eq('shop_id', shopId)
      .eq('status', 'pret')
      .eq('visible', true)
      .order('created_at', { ascending: false });
    return error ? [] : parseList(data).filter((m) => m.url);
  } catch {
    return [];
  }
}

/** Lance une génération. Rend l’identifiant du visuel et le quota restant pour ce type. */
export async function startMedia(
  kind: MediaKind,
  brief: string,
): Promise<Result<{ mediaId: string; quotaLeft: number }>> {
  const res = await callEdge<{ mediaId?: unknown; quotaLeft?: unknown }>('ai-media-start', {
    kind,
    brief: brief.trim().slice(0, 300),
  });
  if (!res.ok) return { ok: false, code: edgeCode(res.code) };
  const { mediaId, quotaLeft } = res.data ?? {};
  return typeof mediaId === 'string'
    ? { ok: true, value: { mediaId, quotaLeft: typeof quotaLeft === 'number' ? quotaLeft : 0 } }
    : { ok: false, code: 'unknown' };
}

/** Relève une génération en cours. */
export async function checkMedia(
  mediaId: string,
): Promise<Result<{ status: MediaStatus; url: string | null }>> {
  const res = await callEdge<{ status?: unknown; url?: unknown }>('ai-media-status', { mediaId });
  if (!res.ok) return { ok: false, code: edgeCode(res.code) };
  const status = z.enum(MEDIA_STATUSES).safeParse(res.data?.status);
  if (!status.success) return { ok: false, code: 'unknown' };
  return {
    ok: true,
    value: { status: status.data, url: typeof res.data?.url === 'string' ? res.data.url : null },
  };
}

/** Montrer ou cacher un visuel sur la vitrine. */
export async function setMediaVisible(mediaId: string, visible: boolean): Promise<Result<null>> {
  try {
    const { error } = await supabase.rpc('set_shop_media_visible', {
      p_media: mediaId,
      p_visible: visible,
    });
    return error ? { ok: false, code: 'unknown' } : { ok: true, value: null };
  } catch {
    return { ok: false, code: 'network' };
  }
}
