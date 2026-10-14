/**
 * Programmer un Flash « demain à telle heure » — CDC V1.1 : un Flash se programme
 * jusqu’à la veille.
 *
 * Fonctions pures : l’horloge est toujours passée en argument, jamais lue ici.
 */

/** Heures rondes proposées pour demain : 08:00 … 20:00, de 1 h en 1 h. */
export const TOMORROW_HOURS: readonly number[] = Array.from({ length: 13 }, (_, i) => 8 + i);

/** Heure proposée par défaut. */
export const DEFAULT_TOMORROW_HOUR = 9;

/** 9 → « 09:00 » : un seul endroit pour la mise en forme. */
export const formatHour = (hour: number): string => `${String(hour).padStart(2, '0')}:00`;

/** Le début de demain à `hour` h, dans le fuseau local de l’appareil. */
export function tomorrowAt(hour: number, now: Date): Date {
  // `new Date(y, m, d + 1, …)` laisse le moteur gérer fin de mois, d’année et
  // février bissextile ; et il construit l’heure LOCALE, donc un passage à l’heure
  // d’été ne décale pas l’heure choisie (contrairement à « now + 24 h »).
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, hour, 0, 0, 0);
}

/**
 * Minutes entre `now` et demain à `hour` h (entier, arrondi à la minute la plus proche —
 * le schéma attend des minutes entières). Toujours positif : demain est après maintenant.
 */
export function minutesUntilTomorrowAt(hour: number, now: Date): number {
  return Math.round((tomorrowAt(hour, now).getTime() - now.getTime()) / 60_000);
}

/**
 * L’instant présent, à lire dans un GESTIONNAIRE d’événement (publier), jamais au rendu :
 * le début de « demain » se calcule à la publication, pas à l’ouverture du formulaire.
 */
export const currentTime = (): Date => new Date();
