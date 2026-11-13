import { isSupabaseConfigured } from './env';
import { fromServer, usePlatformOverrides } from './platform-overrides';
import { supabase } from './supabase';

/**
 * Relit les réglages que le serveur applique (migration 0022) : la commission et le crédit de
 * parrainage, réglés par le Super Admin dans le back-office. Appelé au lancement et à chaque
 * ouverture du panier.
 *
 * Rien ne casse sans réponse : démonstration, migration pas encore appliquée (PGRST202), réseau
 * coupé — l'app garde la dernière valeur connue, ou celle du CDC. Une réponse illisible ne change
 * rien non plus (`fromServer` la valide).
 */
export async function loadServerSettings(): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const { data, error } = await supabase.rpc('platform_public_settings');
    if (error) return;
    const server = fromServer(data);
    if (Object.keys(server).length > 0) usePlatformOverrides.getState().setServer(server);
  } catch {
    // Hors ligne : la dernière valeur connue reste.
  }
}
