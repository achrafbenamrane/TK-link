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

/* -------------------------------------------------------------------------------------------------
 * Programmation simplifiée (rapport d’avancement du 13/11/2026)
 *
 * Un commerçant pense en heures d’horloge — « à 18 h », « demain à 9 h 30 » — pas en délais
 * (« dans 3 h »). Il choisit un jour (aujourd’hui ou demain : un Flash se programme jusqu’à la
 * veille, CDC V1.1) puis un créneau à la demi-heure.
 * ---------------------------------------------------------------------------------------------- */

export type ScheduleDay = 'aujourdhui' | 'demain';

/** Pas des créneaux, premier et dernier créneau proposés (minutes depuis minuit). */
export const SLOT_STEP = 30;
export const FIRST_SLOT = 7 * 60;
export const LAST_SLOT = 22 * 60;
/** Un créneau d’aujourd’hui doit laisser ce délai, sinon autant publier tout de suite. */
const MIN_LEAD = 10;

/** 570 → « 09:30 ». */
export const formatSlot = (minutesOfDay: number): string =>
  `${String(Math.floor(minutesOfDay / 60)).padStart(2, '0')}:${String(minutesOfDay % 60).padStart(2, '0')}`;

/** L’instant local du créneau `minutesOfDay`, aujourd’hui ou demain par rapport à `now`. */
export function slotDate(day: ScheduleDay, minutesOfDay: number, now: Date): Date {
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + (day === 'demain' ? 1 : 0),
    Math.floor(minutesOfDay / 60),
    minutesOfDay % 60,
    0,
    0,
  );
}

/**
 * Les créneaux proposés pour ce jour, en minutes depuis minuit. Aujourd’hui : seulement ceux qui
 * laissent au moins dix minutes — un créneau passé ou imminent n’est pas une programmation.
 */
export function slotsFor(day: ScheduleDay, now: Date): number[] {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const first =
    day === 'demain'
      ? FIRST_SLOT
      : Math.max(FIRST_SLOT, Math.ceil((nowMinutes + MIN_LEAD) / SLOT_STEP) * SLOT_STEP);
  const slots: number[] = [];
  for (let m = first; m <= LAST_SLOT; m += SLOT_STEP) slots.push(m);
  return slots;
}

/** Le créneau sélectionné d’office : le premier libre aujourd’hui, 09:00 demain. */
export function defaultSlot(day: ScheduleDay, now: Date): number | null {
  if (day === 'demain') return DEFAULT_TOMORROW_HOUR * 60;
  return slotsFor('aujourdhui', now)[0] ?? null;
}

/**
 * Minutes entre `now` et le créneau. Un créneau dépassé pendant que le formulaire restait ouvert
 * donne 0 : l’offre part tout de suite plutôt que d’être refusée.
 */
export function minutesUntilSlot(day: ScheduleDay, minutesOfDay: number, now: Date): number {
  return Math.max(
    0,
    Math.round((slotDate(day, minutesOfDay, now).getTime() - now.getTime()) / 60_000),
  );
}

/**
 * L’horodatage (ms) du début d’une offre programmée dans `startInMinutes`, calé sur la minute
 * pleine. Le délai est arrondi à la minute : ajouté tel quel à l’instant présent, il garderait ses
 * secondes et un Flash programmé à 07:30 partirait à 07:29:40.
 */
export function scheduledStartMs(nowMs: number, startInMinutes: number): number {
  return Math.round((nowMs + startInMinutes * 60_000) / 60_000) * 60_000;
}
