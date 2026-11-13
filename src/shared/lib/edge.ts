import { isSupabaseConfigured } from '@/shared/lib/env';
import { supabase } from '@/shared/lib/supabase';

/**
 * Appeler une fonction Edge et obtenir, quoi qu'il arrive, soit sa réponse, soit un CODE lisible.
 *
 * `supabase.functions.invoke` ne lève jamais : il rend `{ data, error }`, et le motif d'un refus
 * (`{ "error": "quota_exhausted" }`) est caché dans la `Response` de `error.context`. Chaque appelant
 * réécrivait cette fouille ; elle vit ici. Les fonctions TK LINK répondent toutes
 * `{ error: '<code>' }` en cas de refus (supabase/functions/_shared/http.ts).
 *
 * Codes génériques : `offline` (la requête n'est pas partie), `not_configured` (pas de serveur, la
 * fonction attend ses secrets — 503 — ou n'est pas encore déployée — 404), `unauthorized`
 * (session absente ou révoquée), `unknown`.
 */
export type EdgeResult<T> =
  { ok: true; data: T } | { ok: false; code: string; status: number | null };

export async function callEdge<T>(
  name: string,
  body: Record<string, unknown> = {},
): Promise<EdgeResult<T>> {
  if (!isSupabaseConfigured) return { ok: false, code: 'not_configured', status: null };
  try {
    const { data, error } = await supabase.functions.invoke(name, { method: 'POST', body });
    if (!error) return { ok: true, data: data as T };

    const context = (error as { context?: unknown }).context as
      | {
          status?: unknown;
          clone?: () => { json: () => Promise<unknown> };
          json?: () => Promise<unknown>;
        }
      | undefined;
    const status = typeof context?.status === 'number' ? context.status : null;
    // Pas de réponse HTTP : la requête n'a pas pu partir (réseau).
    if (status === null) return { ok: false, code: 'offline', status };

    let code: string | null = null;
    try {
      const parsed = (await (context?.clone ? context.clone().json() : context?.json?.())) as
        { error?: unknown } | undefined;
      code = typeof parsed?.error === 'string' ? parsed.error : null;
    } catch {
      code = null;
    }
    if (code) return { ok: false, code, status };
    if (status === 401) return { ok: false, code: 'unauthorized', status };
    // 503 : la fonction attend ses secrets. 404 sans motif TK LINK : la fonction n'est pas encore
    // déployée — pour l'utilisateur, c'est le même « pas encore activé ».
    if (status === 503 || status === 404) return { ok: false, code: 'not_configured', status };
    return { ok: false, code: 'unknown', status };
  } catch {
    return { ok: false, code: 'offline', status: null };
  }
}
