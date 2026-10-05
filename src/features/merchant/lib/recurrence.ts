/**
 * L'OFFRE B2B RÉCURRENTE — CDC V1.1, Grossiste > Règle (EXIGENCE) : « une offre Flash B2B
 * peut être ponctuelle ou marquée récurrente, avec republication automatique selon un rythme
 * choisi par le grossiste — même Flash Engine que le B2C, pas de système de catalogue
 * distinct ».
 *
 * Le CDC ne liste pas les rythmes : on propose les trois d'usage (chaque jour, chaque
 * semaine, chaque mois). Le mois vaut 30 jours — un rythme régulier, pas un calendrier.
 */
export const RECURRENCES = ['aucune', 'quotidienne', 'hebdomadaire', 'mensuelle'] as const;
export type Recurrence = (typeof RECURRENCES)[number];

export const RECURRENCE_LABEL: Record<Recurrence, string> = {
  aucune: 'Ponctuelle',
  quotidienne: 'Chaque jour',
  hebdomadaire: 'Chaque semaine',
  mensuelle: 'Chaque mois',
};

const DAY_MS = 24 * 3600 * 1000;

/** La période entre deux republications, en millisecondes. `null` = ponctuelle. */
export function recurrencePeriodMs(r: Recurrence): number | null {
  switch (r) {
    case 'quotidienne':
      return DAY_MS;
    case 'hebdomadaire':
      return 7 * DAY_MS;
    case 'mensuelle':
      return 30 * DAY_MS;
    default:
      return null;
  }
}

/**
 * Le début de la dernière occurrence due à l'instant `now`, ou `null` si rien n'est à
 * republier. `start` est le début de l'offre courante.
 *
 * On saute directement à la dernière occurrence échue plutôt que d'en créer une par période
 * manquée : un téléphone resté fermé trois semaines ne doit pas ressortir vingt offres.
 */
export function dueOccurrence(start: number, recurrence: Recurrence, now: number): number | null {
  const period = recurrencePeriodMs(recurrence);
  if (period === null || now < start + period) return null;
  return start + Math.floor((now - start) / period) * period;
}
