/**
 * LA BOUTIQUE DU COMMERÇANT — étape 7 du parcours du client (« paramétrage de la
 * boutique : horaires, zone, Touch & Collect, livraison ») et CDC V1.1, Commerçant
 * > Process : « établissement, horaires, profil (photos, vidéos, présentation) ».
 *
 * Tout est pur : ni horloge implicite, ni stockage.
 */

export const DAYS = [
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
  'dimanche',
] as const;
export type Day = (typeof DAYS)[number];

export const DAY_LABEL: Record<Day, string> = {
  lundi: 'Lundi',
  mardi: 'Mardi',
  mercredi: 'Mercredi',
  jeudi: 'Jeudi',
  vendredi: 'Vendredi',
  samedi: 'Samedi',
  dimanche: 'Dimanche',
};

export type DayHours = { open: boolean; from: string; to: string };
export type Hours = Record<Day, DayHours>;

export const MAX_PHOTOS = 6;
export const MAX_VIDEOS = 2;
export const MAX_PRESENTATION = 400;

/**
 * Tout fermé tant que le commerçant n'a rien réglé : on n'invente pas d'horaires.
 * Les heures sont des valeurs de départ pour le formulaire, rien de plus.
 */
export function defaultHours(): Hours {
  const closed: DayHours = { open: false, from: '09:00', to: '18:00' };
  return Object.fromEntries(DAYS.map((d) => [d, { ...closed }])) as Hours;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isTime(value: string): boolean {
  return TIME_RE.test(value);
}

function minutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Erreurs par jour : heure mal formée, ou fermeture avant l'ouverture. */
export function validateHours(hours: Hours): Partial<Record<Day, string>> {
  const errors: Partial<Record<Day, string>> = {};
  for (const day of DAYS) {
    const h = hours[day];
    if (!h.open) continue;
    if (!isTime(h.from) || !isTime(h.to)) errors[day] = 'Heures au format 09:00';
    else if (minutes(h.to) <= minutes(h.from)) errors[day] = 'La fermeture suit l’ouverture';
  }
  return errors;
}

/** Normalise « 9:00 » ou « 9h » en « 09:00 » quand c'est possible ; sinon renvoie tel quel. */
export function normaliseTime(raw: string): string {
  const m = raw
    .trim()
    .replace(/h$/, ':00')
    .replace('h', ':')
    .match(/^(\d{1,2})(?::(\d{1,2}))?$/);
  if (!m) return raw.trim();
  const h = String(Number(m[1])).padStart(2, '0');
  const min = String(Number(m[2] ?? '0')).padStart(2, '0');
  return `${h}:${min}`;
}

const JS_DAY_TO_INDEX = [6, 0, 1, 2, 3, 4, 5]; // dimanche = 0 en JavaScript

/**
 * « Ouvert jusqu'à 19:00 » / « Fermé » / « Horaires non renseignés » — l'état de la
 * boutique à un instant donné. Aucun horaire saisi ⇒ on le dit, on ne devine pas.
 */
export function openStatus(hours: Hours, now: Date): string {
  if (DAYS.every((d) => !hours[d].open)) return 'Horaires non renseignés';
  const day = DAYS[JS_DAY_TO_INDEX[now.getDay()] ?? 0] ?? 'lundi';
  const h = hours[day];
  const current = now.getHours() * 60 + now.getMinutes();
  if (
    h.open &&
    isTime(h.from) &&
    isTime(h.to) &&
    current >= minutes(h.from) &&
    current < minutes(h.to)
  ) {
    return `Ouvert jusqu’à ${h.to}`;
  }
  return 'Fermé';
}
