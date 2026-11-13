const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Quand un message est arrivé, comme dans une messagerie : « À l’instant », « Il y a 12 min »,
 * « 14:05 » aujourd’hui, « Hier, 14:05 », puis la date. `now` est passé (pas d’horloge au rendu).
 */
export function formatWhen(at: number, now: number): string {
  if (!Number.isFinite(at)) return '';
  const minutes = Math.floor((now - at) / 60_000);
  if (minutes < 1) return 'À l’instant';
  if (minutes < 60) return `Il y a ${minutes} min`;
  const d = new Date(at);
  const today = new Date(now);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, today)) return time;
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (sameDay(d, yesterday)) return `Hier, ${time}`;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
