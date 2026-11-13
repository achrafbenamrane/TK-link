import { z } from 'zod';

import { CATEGORIES } from '@/shared/lib/categories';
import { makeId } from '@/shared/lib/id';
import { supabase } from '@/shared/lib/supabase';

import { AUDIENCES, OFFER_MODES, type OfferDraft, type PublishedOffer } from '../model/schema';
import { RECURRENCES } from './recurrence';
import { scheduledStartMs } from './schedule';
import { classifyShopError, type ShopApiError } from './shop-api';

/**
 * LES FLASH DU PROFESSIONNEL SUR LE SERVEUR — table `flash_offers` (migration 0011).
 *
 * Le téléphone déclare l'offre (titre, prix, quantité, durée, heure souhaitée) ; le serveur tient ce
 * qui se compte : le quota d'opérations, le stock restant, l'heure de fin. Seul un commerce validé
 * publie. Les brouillons, eux, restent sur le téléphone : ils ne regardent que leur auteur.
 */

const COLUMNS =
  'id, audience, title, category, description, price_cents, old_price_cents, stock_total, ' +
  'stock_left, min_qty, duration_minutes, starts_at, modes, photo_url, recurrence, offline, created_at';

/** Au-delà d'une minute d'écart entre la création et le début, l'offre a été PROGRAMMÉE. */
const SCHEDULED_AFTER_MS = 60_000;

const ServerOfferSchema = z
  .object({
    id: z.string(),
    audience: z.enum(AUDIENCES),
    title: z.string(),
    category: z.enum(CATEGORIES),
    description: z.string(),
    price_cents: z.number().int(),
    old_price_cents: z.number().int(),
    stock_total: z.number().int(),
    stock_left: z.number().int(),
    min_qty: z.number().int(),
    duration_minutes: z.number().int(),
    starts_at: z.string(),
    modes: z.array(z.enum(OFFER_MODES)),
    photo_url: z.string().nullable(),
    recurrence: z.enum(RECURRENCES),
    offline: z.boolean(),
    created_at: z.string(),
  })
  .transform((r): PublishedOffer => {
    const publishedAt = Date.parse(r.created_at);
    const startsAt = Date.parse(r.starts_at);
    return {
      id: r.id,
      title: r.title,
      category: r.category,
      priceCents: r.price_cents,
      oldPriceCents: r.old_price_cents,
      stock: r.stock_total,
      stockLeft: r.stock_left,
      durationMinutes: r.duration_minutes,
      description: r.description,
      publishedAt,
      // `0` veut dire « à la publication » dans tout l'espace commerçant (voir `startOf`).
      startsAt: startsAt - publishedAt > SCHEDULED_AFTER_MS ? startsAt : 0,
      state: 'publiee',
      offline: r.offline,
      audience: r.audience,
      photoUri: r.photo_url ?? '',
      modes: r.modes,
      seller: '',
      minQty: r.min_qty,
      recurrence: r.recurrence,
    };
  });

export type FlashApiError =
  | ShopApiError
  /** Les opérations offertes (et achetées) sont épuisées — CDC §9. */
  | 'quota'
  /** Pas de commerce validé pour ce compte : la publication est fermée. */
  | 'not_validated'
  /** La photo n'a pas pu partir. */
  | 'photo';

type Result<T> = { ok: true; value: T } | { ok: false; code: FlashApiError };

function classify(error: unknown): FlashApiError {
  const message = String((error as { message?: string } | null)?.message ?? '');
  if (message.includes('quota_exhausted')) return 'quota';
  const code = classifyShopError(error);
  // Une publication refusée par les règles d'accès : le commerce n'est pas (ou plus) validé.
  return code === 'forbidden' ? 'not_validated' : code;
}

/** Le commerce de la personne connectée, s'il est validé. */
async function myValidatedShop(): Promise<Result<{ id: string; ownerId: string }>> {
  const { data: auth } = await supabase.auth.getSession();
  const ownerId = auth.session?.user.id;
  if (!ownerId) return { ok: false, code: 'not_signed_in' };
  const { data, error } = await supabase
    .from('shops')
    .select('id, status')
    .eq('owner_id', ownerId)
    .maybeSingle();
  if (error) return { ok: false, code: classify(error) };
  if (!data || data.status !== 'valide') return { ok: false, code: 'not_validated' };
  return { ok: true, value: { id: String(data.id), ownerId } };
}

const MIME: Record<string, string> = { png: 'image/png', webp: 'image/webp' };

/**
 * Envoie la photo prise sur le téléphone dans le dossier du compte (`flash-photos/<id>/…`) et rend
 * son adresse publique. Une adresse déjà en ligne (https) est gardée telle quelle.
 */
async function uploadPhoto(uri: string, ownerId: string): Promise<string | null> {
  if (/^https:\/\//.test(uri)) return uri;
  const ext = (uri.split('?')[0]?.split('.').pop() ?? 'jpg').toLowerCase();
  const contentType = MIME[ext] ?? 'image/jpeg';
  const path = `${ownerId}/${makeId()}.${MIME[ext] ? ext : 'jpg'}`;
  const bytes = await (await fetch(uri)).arrayBuffer();
  const { error } = await supabase.storage
    .from('flash-photos')
    .upload(path, bytes, { contentType, upsert: false });
  if (error) return null;
  return supabase.storage.from('flash-photos').getPublicUrl(path).data.publicUrl;
}

/** Publie une offre pour SON commerce validé. Le serveur rend l'offre telle qu'il l'a enregistrée. */
export async function publishFlash(
  draft: OfferDraft,
  nowMs: number,
): Promise<Result<PublishedOffer>> {
  try {
    const shop = await myValidatedShop();
    if (!shop.ok) return shop;

    let photoUrl: string | null = null;
    if (draft.photoUri) {
      try {
        photoUrl = await uploadPhoto(draft.photoUri, shop.value.ownerId);
      } catch {
        photoUrl = null;
      }
      if (!photoUrl) return { ok: false, code: 'photo' };
    }

    const { data, error } = await supabase
      .from('flash_offers')
      .insert({
        shop_id: shop.value.id,
        audience: draft.audience,
        title: draft.title.trim(),
        category: draft.category,
        description: draft.description,
        price_cents: draft.priceCents,
        old_price_cents: draft.oldPriceCents,
        stock_total: draft.stock,
        min_qty: draft.minQty,
        duration_minutes: draft.durationMinutes,
        modes: draft.modes,
        recurrence: draft.recurrence,
        ...(photoUrl ? { photo_url: photoUrl } : {}),
        // Une heure SOUHAITÉE : le serveur ne la laisse pas reculer dans le passé.
        ...(draft.startInMinutes
          ? { starts_at: new Date(scheduledStartMs(nowMs, draft.startInMinutes)).toISOString() }
          : {}),
      })
      .select(COLUMNS)
      .single();
    if (error) return { ok: false, code: classify(error) };
    const parsed = ServerOfferSchema.safeParse(data);
    return parsed.success ? { ok: true, value: parsed.data } : { ok: false, code: 'unknown' };
  } catch (error) {
    return { ok: false, code: classify(error) };
  }
}

/** Toutes les offres publiées par SON commerce, en ligne ou non, les plus récentes d'abord. */
export async function fetchMyFlashes(): Promise<Result<PublishedOffer[]>> {
  try {
    const shop = await myValidatedShop();
    if (!shop.ok) return shop.code === 'not_validated' ? { ok: true, value: [] } : shop;
    const { data, error } = await supabase
      .from('flash_offers')
      .select(COLUMNS)
      .eq('shop_id', shop.value.id)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) return { ok: false, code: classify(error) };
    const parsed = z.array(ServerOfferSchema).safeParse(data);
    return parsed.success ? { ok: true, value: parsed.data } : { ok: false, code: 'unknown' };
  } catch (error) {
    return { ok: false, code: classify(error) };
  }
}

/** Retire une offre avant son terme. Elle ne revient pas en ligne (règle du serveur). */
export async function withdrawFlash(id: string): Promise<Result<null>> {
  try {
    const { error } = await supabase.from('flash_offers').update({ offline: true }).eq('id', id);
    return error ? { ok: false, code: classify(error) } : { ok: true, value: null };
  } catch (error) {
    return { ok: false, code: classify(error) };
  }
}
