/**
 * Les chiffres du back-office (Vue d'ensemble, Comptes, Revenus), tirés des VRAIES tables : comptes
 * (`profiles`), commerces (`shops`), Flash publiés (`flash_offers`), commandes (`flash_orders`).
 * Pur, testé par `landing/__tests__/admin-stats.test.ts`.
 *
 * Ce qui compte comme VENDU : une commande payée qui n'a été ni refusée ni remboursée (le litige
 * reste compté tant qu'il n'est pas tranché). Le volume est le montant des articles ; la commission
 * est celle que le serveur a calculée à la réservation (`commission_cents`) ; le revenu de TK LINK est
 * la commission MOINS les réductions qu'il finance (crédit de parrainage, `discount_cents`).
 */

export const SOLD = new Set([
  'payee',
  'acceptee',
  'preparation',
  'prete',
  'en_livraison',
  'recuperee',
  'livree',
  'litige',
]);

const MONTH_LABEL = [
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

const DAY = 24 * 3600 * 1000;

/** Les six derniers mois, du plus ancien au plus récent, avec leur clé « AAAA-MM ». */
function lastSixMonths(nowMs) {
  const now = new Date(nowMs);
  const out = [];
  for (let back = 5; back >= 0; back -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    out.push({
      key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
      label: MONTH_LABEL[d.getUTCMonth()],
    });
  }
  return out;
}

const monthKey = (iso) => {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

export function toStats(profiles, shops, offers, orders, nowMs) {
  const shopByOwner = new Map((shops ?? []).map((s) => [s.owner_id, s]));
  const offersByShop = new Map();
  for (const o of offers ?? []) offersByShop.set(o.shop_id, (offersByShop.get(o.shop_id) ?? 0) + 1);

  const sold = (orders ?? []).filter((o) => SOLD.has(o.status));
  const goods = (o) => Math.max(0, (o.subtotal_cents ?? 0) - (o.discount_cents ?? 0));
  const byCustomer = new Map();
  const byShop = new Map();
  for (const o of sold) {
    const c = byCustomer.get(o.customer_id) ?? { orders: 0, cents: 0 };
    byCustomer.set(o.customer_id, { orders: c.orders + 1, cents: c.cents + goods(o) });
    byShop.set(o.shop_id, (byShop.get(o.shop_id) ?? 0) + goods(o));
  }

  const members = (profiles ?? []).map((p) => {
    const role = p.account_type ?? 'consommateur';
    const shop = shopByOwner.get(p.id);
    const pro = role !== 'consommateur';
    const name =
      pro && shop?.name
        ? shop.name
        : [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Sans nom';
    const joined = Date.parse(p.created_at);
    return {
      id: p.id,
      name,
      role,
      city: shop?.area || (shop?.address ? shop.address.split(',').pop().trim() : ''),
      daysAgo: Number.isFinite(joined) ? Math.max(0, Math.floor((nowMs - joined) / DAY)) : 0,
      joinedAt: Number.isFinite(joined) ? joined : nowMs,
      siret: shop?.siret ?? '',
      offers: shop ? (offersByShop.get(shop.id) ?? 0) : 0,
      orders: byCustomer.get(p.id)?.orders ?? 0,
      // Client : ce qu'il a acheté. Professionnel : ce que son commerce a vendu.
      spentCents: pro
        ? shop
          ? (byShop.get(shop.id) ?? 0)
          : 0
        : (byCustomer.get(p.id)?.cents ?? 0),
      // Un professionnel sans SIRET (pas encore de dossier) est « incomplet ».
      incomplete: pro && !shop?.siret,
    };
  });

  const months = lastSixMonths(nowMs).map(({ key, label }) => {
    const inMonth = sold.filter((o) => monthKey(o.created_at) === key);
    const gmvCents = inMonth.reduce((s, o) => s + goods(o), 0);
    const commissionCents = inMonth.reduce((s, o) => s + (o.commission_cents ?? 0), 0);
    const fundedCents = inMonth.reduce((s, o) => s + (o.discount_cents ?? 0), 0);
    return { label, gmvCents, commissionCents, revenueCents: commissionCents - fundedCents };
  });

  // Les totaux couvrent les MÊMES six mois que le tableau des revenus : deux onglets, un chiffre.
  const sum = (key) => months.reduce((acc, m) => acc + m[key], 0);
  const totals = {
    members: members.length,
    pros: members.filter((m) => m.role !== 'consommateur').length,
    incomplete: members.filter((m) => m.incomplete).length,
    offers: (offers ?? []).length,
    gmvCents: sum('gmvCents'),
    commissionCents: sum('commissionCents'),
    revenueCents: sum('revenueCents'),
  };

  return { members, months, totals };
}
