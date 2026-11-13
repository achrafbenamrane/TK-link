import { z } from 'zod';

import { isSupabaseConfigured } from '@/shared/lib/env';
import { supabase } from '@/shared/lib/supabase';

/**
 * LE PARRAINAGE SUR LE SERVEUR (migration 0019).
 *
 * Mon code, mon parrain, mon crédit et mes filleuls viennent du serveur ; il vérifie aussi qui a le
 * droit d'être parrainé (un nouveau client, une fois, pas soi-même). Tant que la migration n'est pas
 * appliquée, les fonctions répondent « introuvables » : `unavailable`, et l'app garde le parrainage
 * local d'avant.
 */
export type ReferralError =
  | 'invalid_code'
  | 'own_code'
  | 'already_referred'
  | 'already_customer'
  | 'unavailable'
  | 'network'
  | 'unknown';

const KNOWN: readonly ReferralError[] = [
  'invalid_code',
  'own_code',
  'already_referred',
  'already_customer',
];

export function classifyReferralError(error: unknown): ReferralError {
  const e = (error ?? {}) as { message?: string; code?: string };
  const message = String(e.message ?? error ?? '');
  const motif = KNOWN.find((k) => message.includes(k));
  if (motif) return motif;
  // Fonction absente (migration 0019 pas encore appliquée) : PostgREST répond PGRST202.
  if (e.code === 'PGRST202' || /could not find the function/i.test(message)) return 'unavailable';
  if (/network|failed to fetch|fetch failed|timed? ?out/i.test(message)) return 'network';
  return 'unknown';
}

type Result<T> = { ok: true; value: T } | { ok: false; code: ReferralError };

const SummarySchema = z.object({
  code: z.string(),
  referrer_code: z.string().nullable(),
  unlocked: z.boolean(),
  balance_cents: z.number().int(),
  credit_cents: z.number().int(),
  invited: z.number().int(),
  invited_unlocked: z.number().int(),
});

export type ServerReferral = {
  code: string;
  /** Le code de mon parrain ; `null` si je n'en ai pas. */
  referrerCode: string | null;
  /** Mon premier achat réel a débloqué le crédit (côté filleul). */
  unlocked: boolean;
  /** Ce qui me reste à dépenser, en centimes (parrain et filleul confondus). */
  balanceCents: number;
  /** Le montant d'un crédit de parrainage (5 € au lancement). */
  creditCents: number;
  /** Les proches qui ont saisi mon code, et ceux dont le premier achat est fait. */
  invited: number;
  invitedUnlocked: number;
};

export async function fetchReferralSummary(): Promise<Result<ServerReferral>> {
  if (!isSupabaseConfigured) return { ok: false, code: 'unavailable' };
  try {
    const { data, error } = await supabase.rpc('referral_summary');
    if (error) return { ok: false, code: classifyReferralError(error) };
    const parsed = SummarySchema.safeParse(data);
    if (!parsed.success) return { ok: false, code: 'unknown' };
    const s = parsed.data;
    return {
      ok: true,
      value: {
        code: s.code,
        referrerCode: s.referrer_code,
        unlocked: s.unlocked,
        balanceCents: s.balance_cents,
        creditCents: s.credit_cents,
        invited: s.invited,
        invitedUnlocked: s.invited_unlocked,
      },
    };
  } catch (error) {
    return { ok: false, code: classifyReferralError(error) };
  }
}

export async function applyReferralCodeOnServer(code: string): Promise<Result<null>> {
  try {
    const { error } = await supabase.rpc('apply_referral_code', { p_code: code });
    return error ? { ok: false, code: classifyReferralError(error) } : { ok: true, value: null };
  } catch (error) {
    return { ok: false, code: classifyReferralError(error) };
  }
}
