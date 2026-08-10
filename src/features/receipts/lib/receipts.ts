import type { Receipt, ReceiptCategory, ReceiptLine } from '../model/schema';

/**
 * Logique pure du ticket dématérialisé — aucun rendu, aucun aléa caché.
 *
 * Tout l'argent est en CENTIMES (entiers). Un centime perdu dans un arrondi
 * flottant devient un écart comptable ; on ne prend pas ce risque.
 */

/** Taux de TVA standard en France. Les taux réduits viendront du back-end. */
export const VAT_RATE_STANDARD = 0.2;

/** Total TTC d'une liste de lignes. */
export function linesTotalCents(lines: ReceiptLine[]): number {
  return lines.reduce((sum, l) => sum + l.unitCents * l.qty, 0);
}

/**
 * Décompose un TTC en HT + TVA. On calcule la TVA par arrondi puis on déduit le
 * HT, pour que `net + vat === total` soit TOUJOURS vrai — c'est l'invariant sur
 * lequel s'appuie la comptabilité.
 */
export function splitVat(
  totalCents: number,
  rate: number = VAT_RATE_STANDARD,
): { netCents: number; vatCents: number } {
  const netCents = Math.round(totalCents / (1 + rate));
  return { netCents, vatCents: totalCents - netCents };
}

/** Montant lisible : 1234 → « 12,34 € ». Devise en suffixe, à la française. */
export function formatMoney(cents: number, currency = 'EUR'): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const body = `${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
  return `${sign}${body} ${currency === 'EUR' ? '€' : currency}`;
}

/** Libellé court d'une catégorie, pour les puces et les filtres. */
export const CATEGORY_LABEL: Record<ReceiptCategory, string> = {
  alimentation: 'Alimentation',
  restauration: 'Restauration',
  carburant: 'Carburant',
  transport: 'Transport',
  fournitures: 'Fournitures',
  sante: 'Santé',
  loisirs: 'Loisirs',
  autre: 'Autre',
};

/**
 * Regroupe les tickets par mois (du plus récent au plus ancien) — c'est ainsi
 * qu'on cherche un ticket : « c'était en mars ».
 */
export type ReceiptGroup = { key: string; label: string; receipts: Receipt[]; totalCents: number };

const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

export function groupByMonth(receipts: Receipt[]): ReceiptGroup[] {
  const byKey = new Map<string, Receipt[]>();
  for (const r of [...receipts].sort((a, b) => b.issuedAt - a.issuedAt)) {
    const d = new Date(r.issuedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const bucket = byKey.get(key);
    if (bucket) bucket.push(r);
    else byKey.set(key, [r]);
  }
  return [...byKey.entries()].map(([key, list]) => {
    const d = new Date(list[0]!.issuedAt);
    return {
      key,
      label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
      receipts: list,
      totalCents: list.reduce((s, r) => s + r.totalCents, 0),
    };
  });
}

/** Total dépensé sur une période (bornes en ms epoch, incluses). */
export function totalBetween(receipts: Receipt[], fromMs: number, toMs: number): number {
  return receipts
    .filter((r) => r.issuedAt >= fromMs && r.issuedAt <= toMs)
    .reduce((s, r) => s + r.totalCents, 0);
}

/** Dépense par catégorie, triée du plus gros au plus petit (écran « Dépenses »). */
export function totalsByCategory(
  receipts: Receipt[],
): { category: ReceiptCategory; cents: number }[] {
  const acc = new Map<ReceiptCategory, number>();
  for (const r of receipts) acc.set(r.category, (acc.get(r.category) ?? 0) + r.totalCents);
  return [...acc.entries()]
    .map(([category, cents]) => ({ category, cents }))
    .sort((a, b) => b.cents - a.cents);
}

/**
 * Recherche plein texte simple : enseigne, référence, et libellés des lignes.
 * Insensible à la casse et aux accents — « cafe » doit trouver « Café ».
 */
const fold = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export function searchReceipts(receipts: Receipt[], query: string): Receipt[] {
  const q = fold(query.trim());
  if (!q) return receipts;
  return receipts.filter((r) => {
    const hay = fold(`${r.merchant} ${r.reference} ${r.lines.map((l) => l.label).join(' ')}`);
    return hay.includes(q);
  });
}

/* ─── Impact évité ──────────────────────────────────────────────────────────
 *
 * Chiffres de la vidéo de marque, pour la France et par an :
 *   30 milliards de tickets → 150 000 t de papier · 1,8 M d'arbres · 75 Md L d'eau
 *
 * Ramenés à UN ticket, ça donne les constantes ci-dessous. C'est le message du
 * produit rendu personnel : « voilà ce que VOUS avez évité ». Chaque valeur est
 * dérivée des chiffres du client, pas inventée.
 */

/** 150 000 t ÷ 30 Md = 5 g de papier par ticket. */
export const PAPER_G_PER_RECEIPT = 5;
/** 75 Md L ÷ 30 Md = 2,5 L d'eau par ticket. */
export const WATER_L_PER_RECEIPT = 2.5;
/** 30 Md ÷ 1,8 M = 16 667 tickets par arbre. */
export const RECEIPTS_PER_TREE = 16_667;

export type EcoImpact = { receipts: number; paperG: number; waterL: number; treeShare: number };

/** Ce qu'un nombre de tickets dématérialisés a évité. */
export function ecoImpact(receiptCount: number): EcoImpact {
  return {
    receipts: receiptCount,
    paperG: receiptCount * PAPER_G_PER_RECEIPT,
    waterL: receiptCount * WATER_L_PER_RECEIPT,
    treeShare: receiptCount / RECEIPTS_PER_TREE,
  };
}

/** Masse lisible : 5 g reste en grammes, 1 500 g devient « 1,5 kg ». */
export function formatGrams(g: number): string {
  if (g < 1000) return `${Math.round(g)} g`;
  const kg = g / 1000;
  return `${kg.toFixed(kg < 10 ? 1 : 0).replace('.', ',')} kg`;
}

/** Volume lisible : 2,5 L, puis en m³ au-delà de 1 000 L. */
export function formatLiters(l: number): string {
  if (l < 1000) return `${l.toFixed(l < 10 ? 1 : 0).replace('.', ',')} L`;
  return `${(l / 1000).toFixed(1).replace('.', ',')} m³`;
}

/**
 * Empreinte du certificat de facture unique. En production elle est SIGNÉE par
 * le serveur (elle rend la facture opposable) ; ici on produit une valeur
 * stable et lisible pour la démo, dérivée du contenu du ticket.
 */
export function certificateFor(
  receipt: Pick<Receipt, 'reference' | 'issuedAt' | 'totalCents'>,
): string {
  const raw = `${receipt.reference}|${receipt.issuedAt}|${receipt.totalCents}`;
  let h = 0;
  for (let i = 0; i < raw.length; i++) h = (h * 31 + raw.charCodeAt(i)) >>> 0;
  const hex = h.toString(16).toUpperCase().padStart(8, '0');
  return `TK-${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

/**
 * Convertit un ticket en facture certifiée. Fonction PURE : elle renvoie un
 * nouveau ticket, elle ne touche pas à l'original. Déjà converti → inchangé.
 */
/**
 * Le ticket né d'une commande donnée, s'il existe — CDC §14.
 *
 * C'est la garde anti-doublon de la chaîne « commande → ticket » : sans elle,
 * chaque passage du pont émettrait un ticket de plus pour la même commande.
 */
export function receiptForOrder(receipts: Receipt[], orderId: string): Receipt | undefined {
  if (!orderId) return undefined;
  return receipts.find((r) => r.orderId === orderId);
}

export function toInvoice(receipt: Receipt): Receipt {
  if (receipt.kind === 'facture') return receipt;
  return { ...receipt, kind: 'facture', certificateId: certificateFor(receipt) };
}
