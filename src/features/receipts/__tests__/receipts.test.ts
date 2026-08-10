import {
  CATEGORY_LABEL,
  certificateFor,
  ecoImpact,
  formatGrams,
  formatLiters,
  formatMoney,
  PAPER_G_PER_RECEIPT,
  WATER_L_PER_RECEIPT,
  groupByMonth,
  linesTotalCents,
  searchReceipts,
  splitVat,
  toInvoice,
  totalBetween,
  totalsByCategory,
  VAT_RATE_STANDARD,
} from '../lib/receipts';
import type { Receipt } from '../model/schema';

function mk(over: Partial<Receipt> = {}): Receipt {
  return {
    id: 'r1',
    merchant: 'Carrefour City',
    reference: 'FC-2026-0001',
    issuedAt: Date.UTC(2026, 2, 12, 10, 0),
    currency: 'EUR',
    totalCents: 1200,
    vatCents: 200,
    netCents: 1000,
    dueAt: null,
    category: 'alimentation',
    supplierCode: '',
    lines: [],
    channel: 'store',
    kind: 'ticket',
    certificateId: '',
    pointsEarned: 12,
    pinned: false,
    orderId: '',
    ...over,
  };
}

describe('splitVat', () => {
  it('garantit net + tva === total (invariant comptable)', () => {
    for (const total of [1, 99, 100, 999, 1234, 5678, 100000, 1]) {
      const { netCents, vatCents } = splitVat(total);
      expect(netCents + vatCents).toBe(total);
      expect(Number.isInteger(netCents)).toBe(true);
      expect(Number.isInteger(vatCents)).toBe(true);
    }
  });

  it('décompose un TTC au taux standard', () => {
    // 12,00 € TTC à 20 % → 10,00 € HT + 2,00 € de TVA
    expect(splitVat(1200)).toEqual({ netCents: 1000, vatCents: 200 });
    expect(VAT_RATE_STANDARD).toBe(0.2);
  });

  it('accepte un taux réduit', () => {
    const { netCents, vatCents } = splitVat(1050, 0.05);
    expect(netCents + vatCents).toBe(1050);
    expect(netCents).toBe(1000);
  });
});

describe('linesTotalCents', () => {
  it('multiplie par la quantité', () => {
    expect(
      linesTotalCents([
        { label: 'Café', qty: 2, unitCents: 150 },
        { label: 'Pain', qty: 1, unitCents: 110 },
      ]),
    ).toBe(410);
  });

  it('vaut 0 sans ligne', () => {
    expect(linesTotalCents([])).toBe(0);
  });
});

describe('formatMoney', () => {
  it('formate à la française avec deux décimales', () => {
    expect(formatMoney(1234)).toBe('12,34 €');
    expect(formatMoney(5)).toBe('0,05 €');
    expect(formatMoney(0)).toBe('0,00 €');
    expect(formatMoney(100)).toBe('1,00 €');
  });

  it('gère le négatif et une autre devise', () => {
    expect(formatMoney(-250)).toBe('-2,50 €');
    expect(formatMoney(1000, 'USD')).toBe('10,00 USD');
  });
});

describe('groupByMonth', () => {
  it('groupe par mois, du plus récent au plus ancien, avec le total', () => {
    const groups = groupByMonth([
      mk({ id: 'a', issuedAt: Date.UTC(2026, 0, 5), totalCents: 1000 }),
      mk({ id: 'b', issuedAt: Date.UTC(2026, 2, 3), totalCents: 500 }),
      mk({ id: 'c', issuedAt: Date.UTC(2026, 2, 20), totalCents: 700 }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]!.receipts.map((r) => r.id)).toEqual(['c', 'b']); // mars, récent d'abord
    expect(groups[0]!.totalCents).toBe(1200);
    expect(groups[1]!.receipts.map((r) => r.id)).toEqual(['a']);
  });

  it('ne renvoie rien pour une liste vide', () => {
    expect(groupByMonth([])).toEqual([]);
  });
});

describe('totalBetween', () => {
  it('inclut les bornes', () => {
    const list = [
      mk({ id: 'a', issuedAt: 100, totalCents: 10 }),
      mk({ id: 'b', issuedAt: 200, totalCents: 20 }),
      mk({ id: 'c', issuedAt: 300, totalCents: 30 }),
    ];
    expect(totalBetween(list, 100, 300)).toBe(60);
    expect(totalBetween(list, 150, 250)).toBe(20);
    expect(totalBetween(list, 400, 500)).toBe(0);
  });
});

describe('totalsByCategory', () => {
  it('cumule et trie du plus gros au plus petit', () => {
    const res = totalsByCategory([
      mk({ id: 'a', category: 'alimentation', totalCents: 1000 }),
      mk({ id: 'b', category: 'carburant', totalCents: 5000 }),
      mk({ id: 'c', category: 'alimentation', totalCents: 500 }),
    ]);
    expect(res[0]).toEqual({ category: 'carburant', cents: 5000 });
    expect(res[1]).toEqual({ category: 'alimentation', cents: 1500 });
  });

  it('a un libellé pour chaque catégorie', () => {
    expect(CATEGORY_LABEL.alimentation).toBe('Alimentation');
    expect(Object.keys(CATEGORY_LABEL)).toHaveLength(8);
  });
});

describe('searchReceipts', () => {
  const list = [
    mk({ id: 'a', merchant: 'Café de la Gare', reference: 'X1' }),
    mk({ id: 'b', merchant: 'Total Énergies', reference: 'Y2' }),
    mk({
      id: 'c',
      merchant: 'Monoprix',
      reference: 'Z3',
      lines: [{ label: 'Baguette', qty: 1, unitCents: 110 }],
    }),
  ];

  it('ignore les accents et la casse', () => {
    expect(searchReceipts(list, 'cafe').map((r) => r.id)).toEqual(['a']);
    expect(searchReceipts(list, 'ENERGIES').map((r) => r.id)).toEqual(['b']);
  });

  it('cherche aussi dans la référence et les lignes', () => {
    expect(searchReceipts(list, 'Z3').map((r) => r.id)).toEqual(['c']);
    expect(searchReceipts(list, 'baguette').map((r) => r.id)).toEqual(['c']);
  });

  it('rend tout pour une requête vide', () => {
    expect(searchReceipts(list, '   ')).toHaveLength(3);
  });
});

describe('ecoImpact — dérivé des chiffres du client', () => {
  it('applique 5 g de papier et 2,5 L d’eau par ticket', () => {
    expect(ecoImpact(0)).toEqual({ receipts: 0, paperG: 0, waterL: 0, treeShare: 0 });
    const one = ecoImpact(1);
    expect(one.paperG).toBe(PAPER_G_PER_RECEIPT);
    expect(one.waterL).toBe(WATER_L_PER_RECEIPT);
    expect(ecoImpact(100).paperG).toBe(500);
    expect(ecoImpact(100).waterL).toBe(250);
  });

  it('reste cohérent avec les chiffres nationaux de la vidéo', () => {
    // 30 Md de tickets → 150 000 t de papier et 75 Md L d'eau
    const national = ecoImpact(30_000_000_000);
    expect(national.paperG / 1_000_000).toBe(150_000); // grammes → tonnes
    expect(national.waterL).toBe(75_000_000_000);
    expect(Math.round(national.treeShare / 100_000) * 100_000).toBe(1_800_000);
  });

  it('formate masses et volumes de façon lisible', () => {
    expect(formatGrams(5)).toBe('5 g');
    expect(formatGrams(1500)).toBe('1,5 kg');
    expect(formatLiters(2.5)).toBe('2,5 L');
    expect(formatLiters(250)).toBe('250 L');
    expect(formatLiters(2500)).toBe('2,5 m³');
  });
});

describe('toInvoice', () => {
  it('convertit le ticket en facture certifiée sans muter l’original', () => {
    const ticket = mk();
    const invoice = toInvoice(ticket);
    expect(invoice.kind).toBe('facture');
    expect(invoice.certificateId).toMatch(/^TK-[0-9A-F]{4}-[0-9A-F]{4}$/);
    // pureté
    expect(ticket.kind).toBe('ticket');
    expect(ticket.certificateId).toBe('');
  });

  it('est idempotent : reconvertir ne change rien', () => {
    const once = toInvoice(mk());
    expect(toInvoice(once)).toBe(once);
  });

  it('donne un certificat stable pour un même document', () => {
    const a = certificateFor({ reference: 'FC-1', issuedAt: 1000, totalCents: 500 });
    const b = certificateFor({ reference: 'FC-1', issuedAt: 1000, totalCents: 500 });
    const c = certificateFor({ reference: 'FC-2', issuedAt: 1000, totalCents: 500 });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
