import { z } from 'zod';

import { isSupabaseConfigured } from '@/shared/lib/env';
import { supabase } from '@/shared/lib/supabase';

import type { Program } from '../model/merchant-store';
import type { Tier } from './tiers';

/**
 * LA FIDÉLITÉ SUR LE SERVEUR — migration 0017. Les points viennent des commandes honorées (le
 * serveur les crédite) ; un palier se réclame contre un code ; le commerçant valide ce code. Le
 * téléphone lit et demande, il n’écrit rien directement.
 *
 * Seuls les commerces du serveur (identifiant UUID) passent par ici ; les enseignes de démonstration
 * gardent leur fidélité locale.
 */
export const SERVER_SHOP_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isServerShop = (id: string): boolean =>
  isSupabaseConfigured && SERVER_SHOP_ID.test(id);

export type LoyaltyError =
  | 'not_enough_points'
  | 'already_claimed'
  | 'no_such_tier'
  | 'reward_refused'
  | 'reward_not_shareable'
  | 'invalid_program'
  | 'no_shop'
  | 'network'
  | 'unknown';

const KNOWN: readonly LoyaltyError[] = [
  'not_enough_points',
  'already_claimed',
  'no_such_tier',
  'reward_refused',
  'reward_not_shareable',
  'invalid_program',
  'no_shop',
];

export function classifyLoyaltyError(error: unknown): LoyaltyError {
  const message = String((error as { message?: string } | null)?.message ?? error ?? '');
  const motif = KNOWN.find((k) => message.includes(k));
  if (motif) return motif;
  if (/network|failed to fetch|fetch failed|timed? ?out/i.test(message)) return 'network';
  return 'unknown';
}

type Result<T> = { ok: true; value: T } | { ok: false; code: LoyaltyError };

const TierSchema = z.object({
  rank: z.number().int().min(1).max(4),
  cost: z.number().int().positive(),
  reward: z.string(),
  productId: z.string().optional(),
});
const ProgramRowSchema = z.object({
  shop_id: z.string(),
  unit: z.enum(['euros', 'achats']),
  tiers: z.array(TierSchema).min(1).max(4),
});
const LedgerRowSchema = z.object({
  id: z.string(),
  shop_id: z.string(),
  points: z.number().int().positive(),
  created_at: z.string(),
});
const RewardRowSchema = z.object({
  id: z.string(),
  shop_id: z.string(),
  rank: z.number().int(),
  label: z.string(),
  code: z.string(),
  // « partagee » depuis la migration 0018 : offerte à quelqu'un, elle reste dans l'historique.
  status: z.enum(['disponible', 'partagee', 'utilisee']),
  created_at: z.string(),
});

const parseAll = <T>(schema: z.ZodType<T>, rows: unknown): T[] =>
  (Array.isArray(rows) ? rows : []).flatMap((r) => {
    const p = schema.safeParse(r);
    return p.success ? [p.data] : [];
  });

/** Ce que le serveur sait de MA fidélité, par commerce du serveur. */
export type ServerLoyalty = {
  cards: Record<
    string,
    {
      points: number;
      claimed: number[];
      history: { id: string; label: string; points: number; at: number }[];
    }
  >;
  rewards: {
    id: string;
    merchantId: string;
    rank: number;
    label: string;
    code: string;
    status: 'disponible' | 'partagee' | 'utilisee';
    at: number;
  }[];
  programs: Record<string, Program>;
};

/** Mes points, mes récompenses, et les programmes des commerces où j'ai des points. */
export async function fetchMyLoyalty(): Promise<Result<ServerLoyalty>> {
  if (!isSupabaseConfigured) return { ok: false, code: 'unknown' };
  try {
    const { data: session } = await supabase.auth.getSession();
    const uid = session.session?.user.id;
    if (!uid) return { ok: false, code: 'unknown' };
    const [ledger, rewards] = await Promise.all([
      supabase
        .from('loyalty_ledger')
        .select('id, shop_id, points, created_at')
        .eq('customer_id', uid)
        .order('created_at', { ascending: false }),
      supabase
        .from('loyalty_rewards')
        .select('id, shop_id, rank, label, code, status, created_at')
        .eq('customer_id', uid),
    ]);
    if (ledger.error || rewards.error) {
      return { ok: false, code: classifyLoyaltyError(ledger.error ?? rewards.error) };
    }
    const entries = parseAll(LedgerRowSchema, ledger.data);
    const owned = parseAll(RewardRowSchema, rewards.data);
    const shops = [...new Set([...entries.map((e) => e.shop_id), ...owned.map((r) => r.shop_id)])];
    const programs: Record<string, Program> = {};
    if (shops.length) {
      const p = await supabase
        .from('loyalty_programs')
        .select('shop_id, unit, tiers')
        .in('shop_id', shops);
      for (const row of parseAll(ProgramRowSchema, p.data)) {
        programs[row.shop_id] = { unit: row.unit, tiers: row.tiers as Tier[] };
      }
    }
    const cards: ServerLoyalty['cards'] = {};
    for (const shop of shops) {
      const mine = entries.filter((e) => e.shop_id === shop);
      cards[shop] = {
        points: mine.reduce((s, e) => s + e.points, 0),
        claimed: owned.filter((r) => r.shop_id === shop).map((r) => r.rank),
        history: mine.map((e) => ({
          id: e.id,
          label: 'Commande',
          points: e.points,
          at: Date.parse(e.created_at),
        })),
      };
    }
    return {
      ok: true,
      value: {
        cards,
        programs,
        rewards: owned.map((r) => ({
          id: r.id,
          merchantId: r.shop_id,
          rank: r.rank,
          label: r.label,
          code: r.code,
          status: r.status,
          at: Date.parse(r.created_at),
        })),
      },
    };
  } catch (error) {
    return { ok: false, code: classifyLoyaltyError(error) };
  }
}

/** Le programme d'un commerce du serveur (pour l'afficher avant d'y avoir des points). */
export async function fetchProgram(shopId: string): Promise<Program | null> {
  try {
    const { data } = await supabase
      .from('loyalty_programs')
      .select('shop_id, unit, tiers')
      .eq('shop_id', shopId)
      .maybeSingle();
    const parsed = ProgramRowSchema.safeParse(data);
    return parsed.success ? { unit: parsed.data.unit, tiers: parsed.data.tiers as Tier[] } : null;
  } catch {
    return null;
  }
}

/** Réclame un palier atteint chez un commerce du serveur : rend le code de la récompense. */
export async function claimReward(shopId: string, rank: number): Promise<Result<string>> {
  try {
    const { data, error } = await supabase.rpc('claim_reward', { p_shop: shopId, p_rank: rank });
    if (error) return { ok: false, code: classifyLoyaltyError(error) };
    return typeof data === 'string' ? { ok: true, value: data } : { ok: false, code: 'unknown' };
  } catch (error) {
    return { ok: false, code: classifyLoyaltyError(error) };
  }
}

/**
 * Partage MA récompense (migration 0018) : elle quitte mon inventaire, son code reste valable chez
 * le commerçant — c'est un code qu'il valide, pas une personne.
 */
export async function shareRewardOnServer(rewardId: string): Promise<Result<string>> {
  try {
    const { data, error } = await supabase.rpc('share_reward', { p_reward: rewardId });
    if (error) return { ok: false, code: classifyLoyaltyError(error) };
    return typeof data === 'string' ? { ok: true, value: data } : { ok: false, code: 'unknown' };
  } catch (error) {
    return { ok: false, code: classifyLoyaltyError(error) };
  }
}

// ─────────────────────────────────────────────────────────────── le commerçant

/** Le programme de MON commerce, s'il est enregistré. */
export async function fetchMyProgram(): Promise<Program | null> {
  try {
    const { data: session } = await supabase.auth.getSession();
    const uid = session.session?.user.id;
    if (!uid) return null;
    const shop = await supabase.from('shops').select('id').eq('owner_id', uid).maybeSingle();
    const id = (shop.data as { id?: string } | null)?.id;
    return id ? fetchProgram(id) : null;
  } catch {
    return null;
  }
}

/** Enregistre le programme de MON commerce (l'unité, une fois enregistrée, ne change plus). */
export async function saveProgram(program: Program): Promise<Result<null>> {
  try {
    const { error } = await supabase.rpc('save_loyalty_program', {
      p_unit: program.unit,
      p_tiers: program.tiers.map((t, i) => ({
        rank: i + 1,
        cost: t.cost,
        reward: t.reward,
        ...(t.productId ? { productId: t.productId } : {}),
      })),
    });
    return error ? { ok: false, code: classifyLoyaltyError(error) } : { ok: true, value: null };
  } catch (error) {
    return { ok: false, code: classifyLoyaltyError(error) };
  }
}

/** Le commerçant valide une récompense de son commerce : rend ce qu'il doit remettre. */
export async function redeemReward(code: string): Promise<Result<{ label: string; rank: number }>> {
  try {
    const { data, error } = await supabase.rpc('redeem_reward', {
      p_code: code.trim().toUpperCase(),
    });
    if (error) return { ok: false, code: classifyLoyaltyError(error) };
    const parsed = z.object({ label: z.string(), rank: z.number().int() }).safeParse(data);
    return parsed.success ? { ok: true, value: parsed.data } : { ok: false, code: 'unknown' };
  } catch (error) {
    return { ok: false, code: classifyLoyaltyError(error) };
  }
}
