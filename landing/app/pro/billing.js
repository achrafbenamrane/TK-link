/**
 * Le modèle économique — CDC §9 et §21.
 *
 * ⚠️ MIROIR de `src/features/merchant/lib/billing.ts` dans l'app mobile. Les
 * deux surfaces doivent afficher le MÊME quota et la MÊME commission : un
 * commerçant qui lit « 5 % » sur son téléphone et « 7 % » sur le web ne fait
 * plus confiance à aucun des deux. Le jour où l'API existe, ces valeurs
 * viendront du serveur et ce fichier disparaîtra.
 *
 * Toute modification ici doit être reportée là-bas, et réciproquement.
 */

/** Opérations offertes avant le premier pack — CDC §9. */
export const FREE_OPERATIONS = 5;

/** Commission prélevée par TK LINK sur chaque vente, en pourcent — CDC §21. */
export const COMMISSION_PCT = 5;

export const PACKS = [
  { id: 'pack_10', label: 'Pack Découverte', operations: 10, priceCents: 990 },
  { id: 'pack_30', label: 'Pack Quartier', operations: 30, priceCents: 2490 },
  { id: 'pack_100', label: 'Pack Enseigne', operations: 100, priceCents: 6900 },
];

export function freeLeft(used) {
  return Math.max(0, FREE_OPERATIONS - used);
}

export function operationsLeft(used, purchased) {
  return Math.max(0, FREE_OPERATIONS + purchased - used);
}

export function canPublish(used, purchased) {
  return operationsLeft(used, purchased) > 0;
}

/**
 * La commission, arrondie UNE fois. La part du commerçant se calcule par
 * soustraction : deux arrondis indépendants finiraient par perdre un centime.
 */
export function commissionCents(totalCents, pct = COMMISSION_PCT) {
  if (totalCents <= 0) return 0;
  return Math.round((totalCents * pct) / 100);
}

export function netCents(totalCents, pct = COMMISSION_PCT) {
  if (totalCents <= 0) return 0;
  return totalCents - commissionCents(totalCents, pct);
}

/** « 12,90 € » — un montant en centimes, à la française. */
export function formatCents(cents) {
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`;
}

/**
 * Une saisie en euros vers des centimes ; `null` si ce n'est pas un montant.
 * La virgule est acceptée autant que le point : c'est elle qui tombe sous le
 * doigt sur un clavier français.
 */
export function parseEurosToCents(input) {
  const clean = String(input).trim().replace(',', '.');
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return null;
  const value = Number(clean);
  return Number.isFinite(value) ? Math.round(value * 100) : null;
}

/** Les 8 catégories du CDC §4 — mêmes identifiants que l'app. */
export const CATEGORIES = [
  { key: 'restauration', label: 'Restauration', emoji: '🍔' },
  { key: 'high-tech', label: 'High-Tech', emoji: '💻' },
  { key: 'maison', label: 'Maison', emoji: '🛋️' },
  { key: 'mode', label: 'Mode', emoji: '👕' },
  { key: 'beaute', label: 'Beauté', emoji: '💄' },
  { key: 'sport', label: 'Sport', emoji: '🏅' },
  { key: 'auto', label: 'Auto', emoji: '🚗' },
  { key: 'services', label: 'Services', emoji: '🧰' },
];

/** Durées d'une vente flash, en minutes. */
export const DURATIONS = [15, 30, 60, 120, 240];

export function durationLabel(minutes) {
  return minutes < 60 ? `${minutes} min` : `${minutes / 60} h`;
}

/**
 * Valide un brouillon d'offre. Renvoie les erreurs PAR CHAMP : un bandeau
 * global obligerait à deviner lequel des six corriger.
 */
export function validateDraft(draft) {
  const errors = {};
  const title = String(draft.title ?? '').trim();
  if (title.length < 3) errors.title = 'Titre trop court';
  if (title.length > 60) errors.title = 'Titre trop long';

  const price = parseEurosToCents(draft.price);
  const oldPrice = parseEurosToCents(draft.oldPrice);
  if (oldPrice === null || oldPrice <= 0) errors.oldPrice = 'Indiquez le prix initial';
  if (price === null || price <= 0) errors.price = 'Indiquez le prix flash';
  if (price !== null && oldPrice !== null && price >= oldPrice) {
    errors.price = 'Le prix flash doit être inférieur au prix initial';
  }

  const stock = Number.parseInt(draft.stock, 10);
  if (!Number.isFinite(stock) || stock <= 0) errors.stock = 'Indiquez la quantité';

  return {
    errors,
    ok: Object.keys(errors).length === 0,
    priceCents: price,
    oldPriceCents: oldPrice,
    stock,
  };
}
