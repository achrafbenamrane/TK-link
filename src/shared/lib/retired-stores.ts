import { appStorage } from './storage';

/**
 * LES MAGASINS LOCAUX D'UNE FONCTION RETIRÉE — effacés du disque au démarrage.
 *
 * Retirer une fonction retire son code, pas ce qu'elle a écrit sur les téléphones déjà installés.
 * Ce qui reste n'est plus lu par personne, et rien ne l'effacerait jamais :
 *
 * - `tklink-courier-v1` — le livreur, retiré le 13/11/2026 (les livraisons partent chez Uber
 *   Direct). Il gardait le nom vérifié du livreur, l'adresse de son selfie et ses courses : des
 *   données personnelles que plus aucun écran ne montre.
 *
 * Les profils, eux, ne sont PAS effacés : un ancien livreur garde son prénom, son avatar et ses
 * centres d'intérêt, et devient client (voir `RoleSchema` dans `roles.ts`).
 */
export const RETIRED_STORE_KEYS = ['tklink-courier-v1'] as const;

/** Efface ces magasins. Sans effet s'ils n'existent pas ; un échec n'empêche jamais l'app de démarrer. */
export async function forgetRetiredStores(): Promise<void> {
  await Promise.all(RETIRED_STORE_KEYS.map((key) => appStorage.remove(key).catch(() => undefined)));
}
