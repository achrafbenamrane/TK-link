import { openBrowserAsync } from 'expo-web-browser';

import { callEdge } from '@/shared/lib/edge';
import { isSupabaseConfigured } from '@/shared/lib/env';
import { supabase } from '@/shared/lib/supabase';

/**
 * LES PAIEMENTS EN LIGNE DU COMMERÇANT — Stripe Connect (migration 0013, fonction `stripe-connect`).
 *
 * Le commerçant s’inscrit chez Stripe (identité, IBAN : TK LINK n’en voit rien) ; le webhook Stripe
 * dit au serveur quand son commerce peut encaisser (`stripe_charges_enabled`). Sans cela, un client
 * ne peut pas payer ses Flash en ligne.
 */

export type PaymentsStatus =
  /** Pas encore inscrit chez Stripe. */
  | 'absent'
  /** Inscription commencée, en vérification ou incomplète chez Stripe. */
  | 'en_cours'
  /** Le commerce encaisse en ligne. */
  | 'actif';

export type PaymentsError =
  'not_configured' | 'shop_not_validated' | 'no_shop' | 'network' | 'unknown';

type Result<T> = { ok: true; value: T } | { ok: false; code: PaymentsError };

/** L’état du commerce de la personne connectée chez Stripe, ou `null` sans commerce. */
export async function fetchPaymentsStatus(): Promise<Result<PaymentsStatus | null>> {
  if (!isSupabaseConfigured) return { ok: false, code: 'not_configured' };
  try {
    const { data: session } = await supabase.auth.getSession();
    const uid = session.session?.user.id;
    if (!uid) return { ok: false, code: 'unknown' };
    const { data, error } = await supabase
      .from('shops')
      .select('stripe_account_id, stripe_charges_enabled')
      .eq('owner_id', uid)
      .maybeSingle();
    if (error) return { ok: false, code: 'unknown' };
    if (!data) return { ok: true, value: null };
    const row = data as { stripe_account_id: string | null; stripe_charges_enabled: boolean };
    return {
      ok: true,
      value: row.stripe_charges_enabled ? 'actif' : row.stripe_account_id ? 'en_cours' : 'absent',
    };
  } catch {
    return { ok: false, code: 'network' };
  }
}

/**
 * Ouvre l’inscription Stripe (ou sa reprise) dans le navigateur. Rend quand le commerçant revient
 * dans l’app ; l’état se relit ensuite (`fetchPaymentsStatus`).
 */
export async function openPaymentsOnboarding(): Promise<Result<null>> {
  const res = await callEdge<{ url?: unknown }>('stripe-connect');
  if (!res.ok) {
    const code: PaymentsError =
      res.code === 'shop_not_validated' || res.code === 'no_shop'
        ? res.code
        : res.code === 'stripe_not_configured' || res.code === 'not_configured'
          ? 'not_configured'
          : res.code === 'offline'
            ? 'network'
            : 'unknown';
    return { ok: false, code };
  }
  const url = res.data?.url;
  if (typeof url !== 'string' || !url.startsWith('https://')) return { ok: false, code: 'unknown' };
  await openBrowserAsync(url).catch(() => undefined);
  return { ok: true, value: null };
}
