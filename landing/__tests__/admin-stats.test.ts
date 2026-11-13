/* eslint-disable @typescript-eslint/no-require-imports -- why: le site (landing/) est du JS hors tsconfig */

/**
 * Les vrais chiffres du back-office (Vue d'ensemble, Comptes, Revenus) : ce qui compte comme vendu,
 * la commission du serveur, le revenu de TK LINK net de ce qu'il finance, six mois glissants.
 */
const { toStats } = require('../app/admin/stats') as {
  toStats: (
    profiles: unknown[],
    shops: unknown[],
    offers: unknown[],
    orders: unknown[],
    nowMs: number,
  ) => {
    members: {
      id: string;
      name: string;
      role: string;
      siret: string;
      offers: number;
      orders: number;
      spentCents: number;
      incomplete: boolean;
    }[];
    months: { label: string; gmvCents: number; commissionCents: number; revenueCents: number }[];
    totals: Record<string, number>;
  };
};

const NOW = Date.parse('2026-11-14T08:00:00Z');
const order = (o: Record<string, unknown>) => ({
  customer_id: 'c1',
  shop_id: 's1',
  status: 'recuperee',
  subtotal_cents: 700,
  discount_cents: 0,
  commission_cents: 35,
  created_at: '2026-11-13T18:00:00Z',
  ...o,
});

const stats = toStats(
  [
    {
      id: 'c1',
      first_name: 'Sofiane',
      last_name: 'B.',
      account_type: 'consommateur',
      created_at: '2026-11-01T00:00:00Z',
    },
    {
      id: 'm1',
      first_name: 'Karim',
      last_name: '',
      account_type: 'commercant',
      created_at: '2026-10-01T00:00:00Z',
    },
    {
      id: 'm2',
      first_name: 'Nadia',
      last_name: '',
      account_type: 'grossiste',
      created_at: '2026-11-10T00:00:00Z',
    },
  ],
  [
    {
      id: 's1',
      owner_id: 'm1',
      name: 'Le Petit Toulousain',
      siret: '44306184100047',
      address: '8 rue des Carmes, 31000 Toulouse',
      area: 'Carmes',
    },
  ],
  [{ shop_id: 's1' }, { shop_id: 's1' }],
  [
    order({}),
    // Crédit de parrainage : TK LINK finance 0,35 € — son revenu sur cette commande est nul.
    order({ discount_cents: 35, created_at: '2026-11-12T10:00:00Z' }),
    // Pas vendues : réservation en attente, annulée, remboursée.
    order({ status: 'paiement_attente' }),
    order({ status: 'annulee' }),
    order({ status: 'remboursee' }),
    // Octobre.
    order({ subtotal_cents: 2000, commission_cents: 100, created_at: '2026-10-05T10:00:00Z' }),
  ],
  NOW,
);

it('six mois glissants, du plus ancien au plus récent', () => {
  expect(stats.months.map((m) => m.label)).toEqual([
    'juin',
    'juillet',
    'août',
    'septembre',
    'octobre',
    'novembre',
  ]);
});

it('le volume vendu, la commission du serveur, et le revenu net de ce que TK LINK finance', () => {
  const nov = stats.months[5]!;
  expect(nov.gmvCents).toBe(700 + 665);
  expect(nov.commissionCents).toBe(70);
  expect(nov.revenueCents).toBe(35);
  expect(stats.months[4]).toMatchObject({
    gmvCents: 2000,
    commissionCents: 100,
    revenueCents: 100,
  });
  expect(stats.totals).toMatchObject({ gmvCents: 3365, commissionCents: 170, revenueCents: 135 });
});

it('les comptes : le commerce sous son nom, ses Flash et ses ventes ; le pro sans dossier est incomplet', () => {
  const pro = stats.members.find((m) => m.id === 'm1')!;
  expect(pro).toMatchObject({
    name: 'Le Petit Toulousain',
    offers: 2,
    spentCents: 3365,
    incomplete: false,
  });
  expect(stats.members.find((m) => m.id === 'c1')).toMatchObject({ orders: 3, spentCents: 3365 });
  expect(stats.members.find((m) => m.id === 'm2')).toMatchObject({ incomplete: true });
  expect(stats.totals).toMatchObject({ members: 3, pros: 2, incomplete: 1, offers: 2 });
});
