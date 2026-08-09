import { certificateFor, splitVat } from '../lib/receipts';
import type { Receipt, ReceiptCategory, ReceiptChannel, ReceiptLine } from './schema';

/**
 * Tickets de démonstration.
 *
 * En production, un ticket arrive quand le client passe sa carte sur le lecteur
 * en caisse. Le matériel n'étant pas branché, on sème un historique crédible
 * pour que l'app ait de la matière : recherche, groupement par mois, dépenses
 * par catégorie et conversion en facture sont ainsi démontrables.
 *
 * Les dates sont RELATIVES au lancement — des dates figées feraient vieillir la
 * démo (« votre dernier ticket date de huit mois »).
 */

const DAY = 24 * 3600 * 1000;

type Spec = {
  merchant: string;
  category: ReceiptCategory;
  daysAgo: number;
  lines: ReceiptLine[];
  channel?: ReceiptChannel;
  /** Facture pro : échéance à 30 jours. */
  invoice?: boolean;
};

const SPECS: Spec[] = [
  {
    merchant: 'Carrefour City',
    category: 'alimentation',
    daysAgo: 0,
    lines: [
      { label: 'Baguette tradition', qty: 2, unitCents: 120 },
      { label: 'Lait demi-écrémé 1 L', qty: 1, unitCents: 105 },
      { label: 'Œufs bio × 6', qty: 1, unitCents: 329 },
      { label: 'Café moulu 250 g', qty: 1, unitCents: 449 },
    ],
  },
  {
    merchant: 'Boulangerie Marchand',
    category: 'alimentation',
    daysAgo: 1,
    lines: [
      { label: 'Croissant', qty: 3, unitCents: 130 },
      { label: 'Pain au chocolat', qty: 2, unitCents: 140 },
    ],
  },
  {
    merchant: 'TotalEnergies — Station Lyon Est',
    category: 'carburant',
    daysAgo: 3,
    lines: [{ label: 'SP95-E10 — 38,42 L', qty: 1, unitCents: 6837 }],
  },
  {
    merchant: 'Le Comptoir du Midi',
    category: 'restauration',
    daysAgo: 4,
    lines: [
      { label: 'Formule déjeuner', qty: 2, unitCents: 1690 },
      { label: 'Café', qty: 2, unitCents: 220 },
    ],
  },
  {
    merchant: 'Bureau Vallée',
    category: 'fournitures',
    daysAgo: 8,
    lines: [
      { label: 'Ramette A4 80 g × 5', qty: 1, unitCents: 2490 },
      { label: 'Cartouche encre noire', qty: 2, unitCents: 2790 },
    ],
    invoice: true,
  },
  {
    merchant: 'Amazon.fr',
    category: 'fournitures',
    daysAgo: 11,
    channel: 'online',
    lines: [{ label: 'Disque SSD externe 1 To', qty: 1, unitCents: 8999 }],
    invoice: true,
  },
  {
    merchant: 'Pharmacie Centrale',
    category: 'sante',
    daysAgo: 16,
    lines: [
      { label: 'Paracétamol 1 g', qty: 1, unitCents: 215 },
      { label: 'Pansements', qty: 1, unitCents: 389 },
    ],
  },
  {
    merchant: 'SNCF Connect',
    category: 'transport',
    daysAgo: 23,
    channel: 'online',
    lines: [{ label: 'Billet Lyon → Paris', qty: 1, unitCents: 5400 }],
  },
  {
    merchant: 'Monoprix',
    category: 'alimentation',
    daysAgo: 34,
    lines: [
      { label: 'Courses de la semaine', qty: 1, unitCents: 4736 },
      { label: 'Produits d’entretien', qty: 1, unitCents: 1284 },
    ],
  },
  {
    merchant: 'Cinéma Pathé',
    category: 'loisirs',
    daysAgo: 41,
    lines: [{ label: 'Place — séance 20 h 30', qty: 2, unitCents: 1120 }],
  },
];

/** Construit l'historique de démonstration, daté par rapport à `now`. */
export function seedReceipts(now: number = Date.now()): Receipt[] {
  return SPECS.map((spec, i) => {
    const totalCents = spec.lines.reduce((s, l) => s + l.unitCents * l.qty, 0);
    const { netCents, vatCents } = splitVat(totalCents);
    const issuedAt = now - spec.daysAgo * DAY;
    const reference = `${spec.merchant.slice(0, 3).toUpperCase()}-${new Date(issuedAt).getFullYear()}-${String(1000 + i)}`;
    const base = {
      id: `seed_${i}`,
      merchant: spec.merchant,
      reference,
      issuedAt,
      currency: 'EUR',
      totalCents,
      vatCents,
      netCents,
      dueAt: spec.invoice ? issuedAt + 30 * DAY : null,
      category: spec.category,
      supplierCode: '',
      lines: spec.lines,
      channel: spec.channel ?? 'store',
      // 1 point par euro dépensé, arrondi à l'euro inférieur.
      pointsEarned: Math.floor(totalCents / 100),
      pinned: false,
    };
    return spec.invoice
      ? { ...base, kind: 'facture' as const, certificateId: certificateFor(base) }
      : { ...base, kind: 'ticket' as const, certificateId: '' };
  });
}
