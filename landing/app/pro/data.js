/**
 * Données de démonstration de l'espace pro.
 *
 * Elles reprennent la MÊME forme que le schéma de l'app mobile
 * (`src/features/receipts/model/schema.ts`) : montants en centimes, champs
 * extraits identiques. Quand le back-end arrivera, ce fichier disparaît et
 * seule la source change — pas les écrans.
 */

const DAY = 24 * 3600 * 1000;
const now = Date.now();

/** Décompose un TTC en HT + TVA, en garantissant net + tva === total. */
export function splitVat(totalCents, rate = 0.2) {
  const netCents = Math.round(totalCents / (1 + rate));
  return { netCents, vatCents: totalCents - netCents };
}

export function formatMoney(cents, currency = 'EUR') {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const body = `${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
  return `${sign}${body} ${currency === 'EUR' ? '€' : currency}`;
}

export function formatDate(ms, withTime = false) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  const date = `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
  return withTime ? `${date} à ${p(d.getHours())} h ${p(d.getMinutes())}` : date;
}

/** 150 000 t ÷ 30 Md = 5 g de papier par ticket (chiffres de la vidéo). */
export const PAPER_G_PER_RECEIPT = 5;

const RAW = [
  {
    id: 'f1',
    customer: 'Sofiane B.',
    lines: [
      { label: 'Formule déjeuner', qty: 2, unitCents: 1690 },
      { label: 'Café', qty: 2, unitCents: 220 },
    ],
    daysAgo: 0,
    kind: 'facture',
    channel: 'store',
    supplierCode: 'F-0421',
  },
  {
    id: 'f2',
    customer: 'Claire M.',
    lines: [{ label: 'Menu du jour', qty: 1, unitCents: 1450 }],
    daysAgo: 0,
    kind: 'ticket',
    channel: 'store',
    supplierCode: '',
  },
  {
    id: 'f3',
    customer: 'Entreprise Delmas',
    lines: [
      { label: 'Plateau repas × 12', qty: 1, unitCents: 18600 },
      { label: 'Boissons', qty: 12, unitCents: 250 },
    ],
    daysAgo: 1,
    kind: 'facture',
    channel: 'online',
    supplierCode: 'F-0418',
  },
  {
    id: 'f4',
    customer: 'Ahmed T.',
    lines: [{ label: 'Sandwich + boisson', qty: 1, unitCents: 890 }],
    daysAgo: 1,
    kind: 'ticket',
    channel: 'store',
    supplierCode: '',
  },
  {
    id: 'f5',
    customer: 'Julie R.',
    lines: [
      { label: 'Brunch', qty: 2, unitCents: 2400 },
      { label: 'Jus pressé', qty: 2, unitCents: 450 },
    ],
    daysAgo: 2,
    kind: 'facture',
    channel: 'store',
    supplierCode: 'F-0410',
  },
  {
    id: 'f6',
    customer: 'Cabinet Nord',
    lines: [{ label: 'Traiteur réunion', qty: 1, unitCents: 24500 }],
    daysAgo: 4,
    kind: 'facture',
    channel: 'online',
    supplierCode: 'F-0402',
  },
  {
    id: 'f7',
    customer: 'Marc L.',
    lines: [{ label: 'Petit-déjeuner', qty: 1, unitCents: 720 }],
    daysAgo: 5,
    kind: 'ticket',
    channel: 'store',
    supplierCode: '',
  },
  {
    id: 'f8',
    customer: 'Nadia K.',
    lines: [
      { label: 'Formule déjeuner', qty: 3, unitCents: 1690 },
      { label: 'Dessert', qty: 3, unitCents: 550 },
    ],
    daysAgo: 6,
    kind: 'facture',
    channel: 'store',
    supplierCode: 'F-0396',
  },
];

/** Empreinte du certificat de facture unique (stable, dérivée du contenu). */
function certificateFor(reference, issuedAt, totalCents) {
  const raw = `${reference}|${issuedAt}|${totalCents}`;
  let h = 0;
  for (let i = 0; i < raw.length; i++) h = (h * 31 + raw.charCodeAt(i)) >>> 0;
  const hex = h.toString(16).toUpperCase().padStart(8, '0');
  return `TK-${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

export const DOCUMENTS = RAW.map((r, i) => {
  const totalCents = r.lines.reduce((s, l) => s + l.unitCents * l.qty, 0);
  const { netCents, vatCents } = splitVat(totalCents);
  const issuedAt = now - r.daysAgo * DAY - i * 3600 * 1000;
  const reference = `LCM-${new Date(issuedAt).getFullYear()}-${1000 + i}`;
  return {
    ...r,
    reference,
    issuedAt,
    currency: 'EUR',
    totalCents,
    netCents,
    vatCents,
    dueAt: r.kind === 'facture' ? issuedAt + 30 * DAY : null,
    certificateId: r.kind === 'facture' ? certificateFor(reference, issuedAt, totalCents) : '',
    pointsIssued: Math.floor(totalCents / 100),
  };
});

export const OFFERS = [
  {
    id: 'o1',
    title: 'Formule déjeuner',
    claim: '-20 %',
    audience: 'Tous les clients',
    flash: false,
    live: true,
  },
  {
    id: 'o2',
    title: 'Happy hour 17 h – 19 h',
    claim: '2 + 1',
    audience: 'Membres TKtime',
    flash: true,
    live: true,
  },
  {
    id: 'o3',
    title: 'Brunch du dimanche',
    claim: '-15 %',
    audience: 'Tous les clients',
    flash: false,
    live: true,
  },
  {
    id: 'o4',
    title: 'Café offert dès 15 €',
    claim: 'Offert',
    audience: 'Membres TKtime',
    flash: true,
    live: false,
  },
];
