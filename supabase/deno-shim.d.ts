// Ce que les fonctions Edge utilisent de Deno — pour les typer avec `tsc` sur une machine sans Deno
// (`npm run typecheck:edge`). Hors de `supabase/functions/` : rien de ceci n'est déployé.
declare namespace Deno {
  export const env: { get(key: string): string | undefined };
  export function serve(handler: (req: Request) => Response | Promise<Response>): unknown;
}
