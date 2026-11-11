import { z } from 'zod';

import { CATEGORIES, type Category } from '@/shared/lib/categories';
import { normalizeSiret } from '@/shared/lib/roles';
import { supabase } from '@/shared/lib/supabase';

import { OFFER_MODES, type OfferMode } from '../model/schema';
import type { ProRole } from './supplier';

/**
 * LE DOSSIER DU PROFESSIONNEL SUR LE SERVEUR — table `shops` (migration 0010).
 *
 * Le serveur fait foi : c'est lui qui dit si le dossier est en vérification, validé ou refusé, et
 * c'est TK LINK qui le valide. Le téléphone dépose le dossier et relit son statut ; il ne l'écrit
 * jamais (la colonne est hors des droits du client, et un déclencheur la remet en vérification).
 *
 * Toute réponse passe par Zod avant d'atteindre le store : une colonne renommée côté serveur doit
 * échouer ici, lisiblement, et pas trois écrans plus loin.
 */

export const SHOP_STATUSES = ['en_verification', 'valide', 'refuse'] as const;
export type ShopStatus = (typeof SHOP_STATUSES)[number];

const COLUMNS = 'id, kind, name, category, siret, address, area, modes, status, review_note';

const ServerShopSchema = z
  .object({
    id: z.string(),
    kind: z.enum(['commercant', 'grossiste']),
    name: z.string(),
    category: z.enum(CATEGORIES),
    siret: z.string(),
    address: z.string(),
    area: z.string(),
    modes: z.array(z.enum(OFFER_MODES)),
    status: z.enum(SHOP_STATUSES),
    review_note: z.string().nullable(),
  })
  .transform(({ review_note, ...shop }) => ({ ...shop, reviewNote: review_note ?? '' }));

export type ServerShop = z.output<typeof ServerShopSchema>;

/** Ce que le professionnel déclare. Le statut n'en fait pas partie : il ne se déclare pas. */
export type ShopFiling = {
  kind: ProRole;
  name: string;
  category: Category;
  siret: string;
  address: string;
  area: string;
  modes: OfferMode[];
};

export type ShopApiError =
  /** Pas de session serveur : rien à déposer ni à relire. */
  | 'not_signed_in'
  /** Ce SIRET est déjà déposé par un autre compte. */
  | 'siret_taken'
  /** Le serveur refuse une valeur (SIRET mal formé, nom trop court…). */
  | 'invalid'
  /** Le type déclaré du compte n'est pas celui du dossier. */
  | 'forbidden'
  | 'network'
  | 'unknown';

type Result<T> = { ok: true; value: T } | { ok: false; code: ShopApiError };

type PostgrestLikeError = { code?: string; message?: string } | null | undefined;

/** Traduit une erreur PostgREST (ou un échec réseau) en un code que l'écran sait dire. */
export function classifyShopError(error: unknown): ShopApiError {
  const e = error as PostgrestLikeError;
  if (e?.code === '23505') return 'siret_taken';
  if (e?.code === '23514' || e?.code === '22P02') return 'invalid';
  if (e?.code === '42501') return 'forbidden';
  const message = String(e?.message ?? error ?? '');
  if (/network|failed to fetch|fetch failed|timed? ?out/i.test(message)) return 'network';
  return 'unknown';
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

function parse(row: unknown): Result<ServerShop> {
  const parsed = ServerShopSchema.safeParse(row);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, code: 'unknown' };
}

/** Le dossier de la personne connectée, ou `null` si elle n'en a jamais déposé. */
export async function fetchMyShop(): Promise<Result<ServerShop | null>> {
  try {
    const userId = await currentUserId();
    if (!userId) return { ok: false, code: 'not_signed_in' };
    const { data, error } = await supabase
      .from('shops')
      .select(COLUMNS)
      .eq('owner_id', userId)
      .maybeSingle();
    if (error) return { ok: false, code: classifyShopError(error) };
    return data ? parse(data) : { ok: true, value: null };
  } catch (error) {
    return { ok: false, code: classifyShopError(error) };
  }
}

/**
 * Dépose le dossier — ou le corrige s'il existe déjà (un compte, un commerce). Le serveur le met
 * (ou le remet) en vérification de lui-même.
 */
export async function fileMyShop(filing: ShopFiling): Promise<Result<ServerShop>> {
  try {
    const userId = await currentUserId();
    if (!userId) return { ok: false, code: 'not_signed_in' };
    const row = {
      name: filing.name.trim(),
      category: filing.category,
      siret: normalizeSiret(filing.siret),
      address: filing.address.trim(),
      area: filing.area.trim(),
      modes: filing.modes,
    };
    const existing = await supabase.from('shops').select('id').eq('owner_id', userId).maybeSingle();
    if (existing.error) return { ok: false, code: classifyShopError(existing.error) };

    const { data, error } = existing.data
      ? await supabase.from('shops').update(row).eq('id', existing.data.id).select(COLUMNS).single()
      : await supabase
          .from('shops')
          .insert({ ...row, kind: filing.kind })
          .select(COLUMNS)
          .single();
    if (error) return { ok: false, code: classifyShopError(error) };
    return parse(data);
  } catch (error) {
    return { ok: false, code: classifyShopError(error) };
  }
}
