/**
 * Les réglages que le SERVEUR applique (migration 0022, `private.platform_config`), tels que le
 * back-office les montre et les saisit. Le serveur garde des unités entières (points de base,
 * centimes, minutes) ; l'écran parle en %, en € et en minutes. Pur, testé par
 * `landing/__tests__/admin-server-settings.test.ts`.
 */

export const SERVER_SETTINGS = [
  {
    key: 'commission_bps',
    label: 'Commission TK LINK',
    unit: '%',
    scale: 100, // 5 % = 500 points de base
    min: 0,
    max: 30,
    source: 'CDC V1.1 — 5 %, configurable. S’applique aux réservations suivantes.',
  },
  {
    key: 'referral_credit_cents',
    label: 'Crédit de parrainage',
    unit: '€',
    scale: 100,
    min: 0,
    max: 100,
    source: 'CDC V1.1 — 5 € au parrain et au filleul, au premier achat réel du filleul.',
  },
  {
    key: 'reservation_minutes',
    label: 'Durée d’une réservation non payée',
    unit: 'min',
    scale: 1,
    min: 5,
    max: 60,
    source: 'Le stock revient si le client ne paie pas dans ce délai.',
  },
  {
    key: 'max_pending_orders',
    label: 'Réservations non payées par compte',
    unit: 'max',
    scale: 1,
    min: 1,
    max: 10,
    source: 'Contre l’accaparement : au-delà, il faut payer ou annuler.',
  },
  {
    key: 'ai_images_per_day',
    label: 'Visuels IA par commerce et par jour',
    unit: 'images',
    scale: 1,
    min: 0,
    max: 100,
    source: 'Quota fal.ai, payé par TK LINK.',
  },
  {
    key: 'ai_videos_per_day',
    label: 'Vidéos IA par commerce et par jour',
    unit: 'vidéos',
    scale: 1,
    min: 0,
    max: 20,
    source: 'Quota fal.ai, payé par TK LINK.',
  },
];

/** La valeur du serveur, telle que l'écran l'affiche (« 5 », « 7,5 »). */
export function toDisplay(def, serverValue) {
  if (typeof serverValue !== 'number' || !Number.isFinite(serverValue)) return '';
  const v = serverValue / def.scale;
  return String(Number.isInteger(v) ? v : Number(v.toFixed(2))).replace('.', ',');
}

/**
 * Une saisie de l'écran vers la valeur ENTIÈRE du serveur, ou une erreur lisible. La virgule passe
 * autant que le point ; on refuse ce que le serveur refuserait (hors bornes, pas un entier après
 * conversion) plutôt que de l'arrondir en silence.
 */
export function parseInput(def, raw) {
  const text = String(raw ?? '')
    .trim()
    .replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(text)) return { error: 'Un nombre, s’il vous plaît.' };
  const n = Number(text);
  if (n < def.min || n > def.max) return { error: `Entre ${def.min} et ${def.max} ${def.unit}.` };
  const server = n * def.scale;
  if (Math.abs(server - Math.round(server)) > 1e-9) {
    return { error: def.scale === 100 ? 'Deux décimales au plus.' : 'Un nombre entier.' };
  }
  return { value: Math.round(server) };
}
