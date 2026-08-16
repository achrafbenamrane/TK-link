import { certificateFor, splitVat } from '../lib/receipts';
import type { Receipt, ReceiptCategory, ReceiptChannel, ReceiptKind, ReceiptLine } from './schema';

/**
 * Tickets de démonstration.
 *
 * En production, un ticket arrive quand la commande est réglée — le CDC V1.0 a
 * retiré tout le matériel du périmètre (« on reste uniquement sur du soft »),
 * il n'y a donc ni lecteur ni carte. Sans back-end, on sème un historique
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
  /**
   * Force le type du document — CDC §9.1.
   *
   * Par défaut, `invoice` décide entre facture et ticket. Mais la GARANTIE est
   * un troisième cas : c'est une preuve d'achat rattachée à un produit, dont la
   * durée de vie suit celle de la garantie et non l'exercice comptable. Sans
   * elle dans le jeu de démonstration, le filtre correspondant serait toujours
   * vide — un filtre qui ne rend jamais rien se lit comme une panne.
   */
  kind?: ReceiptKind;
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
  // Une garantie — le quatrième document du §9.1. Un achat d'électronique est
  // le cas typique : c'est la preuve qu'on cherche deux ans plus tard, quand
  // l'appareil tombe en panne et que le ticket a disparu depuis longtemps.
  {
    merchant: 'Atelier Son — Capitole',
    category: 'autre',
    daysAgo: 96,
    kind: 'garantie',
    lines: [{ label: 'Casque audio sans fil — garantie 2 ans', qty: 1, unitCents: 8900 }],
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
      orderId: '',
    };
    const kind: ReceiptKind = spec.kind ?? (spec.invoice ? 'facture' : 'ticket');
    // Seule la facture porte un certificat : c'est elle que le §9.6 fait
    // conserver dix ans, et donc elle seule qu'il faut pouvoir prouver intacte.
    return kind === 'facture'
      ? { ...base, kind, certificateId: certificateFor(base) }
      : { ...base, kind, certificateId: '' };
  });
}
