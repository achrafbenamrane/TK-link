/**
 * LE RÉSUMÉ DU JOUR de l'écran d'accueil du livreur : gains, livraisons terminées, et leur
 * évolution par rapport à hier. Que des chiffres tirés de l'historique : rien n'est inventé.
 */
export type HistoryLine = { at: number; gainEur: number };

export type DaySummary = {
  gainsEur: number;
  deliveries: number;
  /** Évolution en % par rapport à hier ; `null` quand hier n'a rien à comparer. */
  gainsDeltaPct: number | null;
  deliveriesDeltaPct: number | null;
};

const startOfDay = (ms: number) => new Date(ms).setHours(0, 0, 0, 0);

function delta(today: number, yesterday: number): number | null {
  if (yesterday <= 0) return null;
  return Math.round(((today - yesterday) / yesterday) * 1000) / 10;
}

export function daySummary(history: HistoryLine[], now: number): DaySummary {
  const today0 = startOfDay(now);
  const yesterday0 = today0 - 24 * 3600 * 1000;
  const today = history.filter((h) => h.at >= today0);
  const yesterday = history.filter((h) => h.at >= yesterday0 && h.at < today0);
  const sum = (l: HistoryLine[]) => Math.round(l.reduce((s, h) => s + h.gainEur, 0) * 100) / 100;

  return {
    gainsEur: sum(today),
    deliveries: today.length,
    gainsDeltaPct: delta(sum(today), sum(yesterday)),
    deliveriesDeltaPct: delta(today.length, yesterday.length),
  };
}

/** « +12,5 % vs hier » — le signe est toujours écrit. */
export function deltaLabel(pct: number | null): string | null {
  if (pct === null) return null;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${String(pct).replace('.', ',')} % vs hier`;
}
