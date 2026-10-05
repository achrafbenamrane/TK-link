const pad = (n: number) => String(n).padStart(2, '0');

const startOfDay = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** « 14:32 » aujourd’hui, « Hier » la veille, « 12/10 » sinon. */
export function timeLabel(ms: number, now: number = Date.now()): string {
  const today = startOfDay(now);
  const d = new Date(ms);
  if (ms >= today) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (ms >= yesterday.getTime()) return 'Hier';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

/** Une ligne d’aperçu : espaces fusionnés, tronquée avec « … » au-delà de `max`. */
export function preview(text: string, max = 60): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}
