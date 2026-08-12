import type { Deal, Screening } from '../model/schema';

/**
 * Les règles d'affichage d'une séance — pures, testables, sans React.
 *
 * Tout ce qui touche à l'heure de fin est calculé ici et nulle part ailleurs :
 * un écran qui recalcule « 20:15 + 2 h 48 » à sa façon finira par se tromper
 * de minuit.
 */

/**
 * Espace insécable — « 2 h » ne doit jamais se couper en fin de ligne.
 *
 * Nommé plutôt que tapé : ce caractère est INVISIBLE. Écrit littéralement, le
 * jour où quelqu'un retouche la ligne il tape une espace ordinaire, le test
 * échoue en affichant deux chaînes strictement identiques à l'œil, et la
 * demi-heure suivante part en fumée. (Vécu.)
 */
export const NBSP = ' ';

/** « 2 h 48 », « 48 min ». Les minutes restent stockées en nombre. */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}${NBSP}h` : `${h}${NBSP}h ${String(m).padStart(2, '0')}`;
}

/** Minutes depuis minuit, ou `null` si l'heure n'est pas au format attendu. */
export function minutesOfDay(startsAt: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(startsAt);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * L'heure de fin de la séance, « 23:03 ».
 *
 * Repasse par minuit sans broncher : une séance de 22 h 30 qui dure trois
 * heures finit à 01:30, pas à 25:30.
 */
export function endsAt(screening: Screening): string | null {
  const start = minutesOfDay(screening.startsAt);
  if (start === null) return null;
  const total = (start + screening.durationMin) % (24 * 60);
  const h = Math.floor(total / 60);
  return `${String(h).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * La ligne de détail sous le titre du film : « Aventure · 2 h 48 · VF · Salle 3 ».
 *
 * Les champs absents disparaissent au lieu de laisser un séparateur orphelin —
 * un « Aventure · · VF » se remarque immédiatement et fait amateur.
 */
export function screeningDetails(screening: Screening): string {
  return [
    screening.genre,
    formatDuration(screening.durationMin),
    screening.version,
    screening.room,
    screening.audience,
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * Ce que lit une synthèse vocale, et ce que porte l'accessibilité de la carte.
 *
 * Une carte de cinéma annoncée « Place de cinéma, 5,90 euros » est inutilisable
 * sans les yeux : c'est le film et l'heure qui décident de l'achat.
 */
export function screeningLabel(screening: Screening): string {
  const end = endsAt(screening);
  return `${screening.film}, séance de ${screening.startsAt.replace(':', ' h ')}${
    end ? `, fin vers ${end.replace(':', ' h ')}` : ''
  }`;
}

/** Les séances d'un même lieu, dans l'ordre de la soirée. */
export function sortByShowtime(deals: Deal[]): Deal[] {
  return [...deals].sort((a, b) => {
    const sa = a.screening ? minutesOfDay(a.screening.startsAt) : null;
    const sb = b.screening ? minutesOfDay(b.screening.startsAt) : null;
    // Ce qui n'a pas d'horaire passe après : on ne lui invente pas une place
    // dans la grille.
    if (sa === null && sb === null) return 0;
    if (sa === null) return 1;
    if (sb === null) return -1;
    return sa - sb;
  });
}
