import { isSupabaseConfigured } from '@/shared/lib/env';
import { supabase } from '@/shared/lib/supabase';

import type { IssueKind, IssueRoute } from './issues';

/**
 * SIGNALER UN PROBLÈME SUR UNE COMMANDE DU SERVEUR (migration 0027) — CDC V1.1 (VALIDÉ) : un point
 * d'entrée unique qui route automatiquement vers un remboursement ou vers la file Super Admin.
 *
 * Le client dit ce qui s'est passé ; `report_order_issue` décide (la même règle que `routeIssue`) et
 * fait passer la commande « remboursement en cours » — le remboursement part alors tout seul chez
 * Stripe — ou « litige ». Tant que 0027 n'est pas appliquée : « indisponible », et l'app retombe sur
 * l'ancien chemin (une demande au support rattachée à la commande).
 */

export type IssueError =
  | 'not_signed_in'
  /** Pas sa commande, ou elle n'existe plus. */
  | 'order_not_found'
  /** Pas payée, déjà close, ou déjà entre les mains de TK LINK. */
  | 'not_reportable'
  | 'already_reported'
  | 'invalid_issue'
  /** Le serveur n'a pas (encore) le signalement : migration 0027 absente, ou pas de serveur. */
  | 'unavailable'
  | 'network'
  | 'unknown';

type Result<T> = { ok: true; value: T } | { ok: false; code: IssueError };

const MOTIFS: readonly IssueError[] = [
  'order_not_found',
  'not_reportable',
  'already_reported',
  'invalid_issue',
];

export function classifyIssueError(error: unknown): IssueError {
  const e = error as { code?: string; message?: string } | null | undefined;
  const message = String(e?.message ?? error ?? '');
  if (/not_authenticated/.test(message)) return 'not_signed_in';
  const motif = MOTIFS.find((m) => message.includes(m));
  if (motif) return motif;
  if (e?.code === 'PGRST202' || e?.code === '42883') return 'unavailable';
  if (/network|failed to fetch|fetch failed|timed? ?out/i.test(message)) return 'network';
  return 'unknown';
}

export const ISSUE_ERROR: Record<IssueError, string> = {
  not_signed_in: 'Connectez-vous pour signaler un problème.',
  order_not_found: 'Cette commande n’est pas la vôtre.',
  not_reportable: 'Cette commande ne peut plus être signalée : écrivez au support.',
  already_reported: 'Vous avez déjà signalé un problème sur cette commande.',
  invalid_issue: 'Choisissez ce qui s’est passé.',
  unavailable: 'Le signalement n’est pas encore ouvert. Écrivez au support.',
  network: 'Pas de connexion. Réessayez dans un instant.',
  unknown: 'Le signalement n’a pas pu être envoyé. Réessayez.',
};

const ROUTES: readonly IssueRoute[] = ['remboursement', 'admin'];

/** Signale le problème ; le serveur répond où il part. */
export async function reportServerIssue(
  orderId: string,
  kind: IssueKind,
): Promise<Result<IssueRoute>> {
  if (!isSupabaseConfigured) return { ok: false, code: 'unavailable' };
  try {
    const { data, error } = await supabase.rpc('report_order_issue', {
      p_order: orderId,
      p_kind: kind,
    });
    if (error) return { ok: false, code: classifyIssueError(error) };
    return ROUTES.includes(data as IssueRoute)
      ? { ok: true, value: data as IssueRoute }
      : { ok: false, code: 'unknown' };
  } catch (error) {
    return { ok: false, code: classifyIssueError(error) };
  }
}
