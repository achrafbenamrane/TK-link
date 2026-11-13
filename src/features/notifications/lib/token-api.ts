import { supabase } from '@/shared/lib/supabase';

/**
 * Le jeton de notification de ce téléphone, sur le serveur (migration 0016). Écrit par fonction :
 * la table n’est ni lisible ni modifiable directement. Un téléphone repris par un autre compte
 * change de propriétaire côté serveur.
 */
export async function registerToken(token: string, platform: 'ios' | 'android'): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('register_push_token', {
      p_token: token,
      p_platform: platform,
    });
    return !error;
  } catch {
    return false;
  }
}

/** Retire ce téléphone du compte connecté (avant la déconnexion : il faut encore la session). */
export async function unregisterToken(token: string): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('unregister_push_token', { p_token: token });
    return !error;
  } catch {
    return false;
  }
}
