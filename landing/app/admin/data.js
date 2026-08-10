import { COMMISSION_PCT, PACKS, commissionCents } from '../pro/billing';

/**
 * Données de démonstration du Super Admin — CDC §17.
 *
 * ⚠️ Aucun back-end : ces inscrits, ces transactions et ces packs sont
 * fabriqués ici. Ils ont en revanche la MÊME forme que ce que le serveur
 * renverra (rôles du §3, SIRET du §5, montants en centimes, commission du
 * §21) : le jour où l'API existe, ce fichier disparaît et les écrans ne
 * bougent pas.
 *
 * Les dates sont RELATIVES au chargement : figer un calendrier ferait vieillir
 * la démonstration en quelques jours.
 */

const DAY = 24 * 3600 * 1000;
const now = Date.now();

/**
 * Un montant en centimes, groupé par milliers : « 44 640,00 € ».
 *
 * Le séparateur est posé À LA MAIN plutôt que par `toLocaleString` : Node et le
 * navigateur ne choisissent pas toujours la même espace insécable, et l'écart
 * suffit à déclencher une erreur d'hydratation sur une page prérendue.
 */
/** L'espace FINE INSÉCABLE des milliers (U+202F), en typographie française. */
const THIN_NBSP = ' ';

export function formatEuros(cents) {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const whole = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, THIN_NBSP);
  return `${sign}${whole},${String(abs % 100).padStart(2, '0')} €`;
}

/** Les trois rôles du CDC §3, avec leur libellé et leur couleur de pastille. */
export const ROLE_INFO = {
  consommateur: { label: 'Consommateur', tone: 'ticket' },
  commercant: { label: 'Commerçant', tone: 'facture' },
  grossiste: { label: 'Grossiste', tone: 'online' },
};

/**
 * Les inscrits. `siret` n'existe que pour les professionnels — CDC §5 : c'est
 * lui qui autorise la commande chez un grossiste.
 */
const RAW_MEMBERS = [
  {
    id: 'u1',
    name: 'Sofiane Belkacem',
    role: 'consommateur',
    city: 'Toulouse · Empalot',
    daysAgo: 2,
    orders: 4,
    spentCents: 6740,
  },
  {
    id: 'u2',
    name: 'Le Comptoir du Midi',
    role: 'commercant',
    city: 'Toulouse · Carmes',
    daysAgo: 41,
    siret: '89498206300019',
    offers: 27,
    spentCents: 985000,
  },
  {
    id: 'u3',
    name: 'Claire Mounier',
    role: 'consommateur',
    city: 'Toulouse · Saint-Cyprien',
    daysAgo: 9,
    orders: 11,
    spentCents: 14820,
  },
  {
    id: 'u4',
    name: 'Grossiste Occitan',
    role: 'grossiste',
    city: 'Fenouillet',
    daysAgo: 63,
    siret: '52321478900024',
    offers: 14,
    spentCents: 0,
  },
  {
    id: 'u5',
    name: 'Boulangerie Saint-Cyprien',
    role: 'commercant',
    city: 'Toulouse · Saint-Cyprien',
    daysAgo: 35,
    siret: '41234567800018',
    offers: 52,
    spentCents: 1284000,
  },
  {
    id: 'u6',
    name: 'Yanis Traoré',
    role: 'consommateur',
    city: 'Toulouse · Bagatelle',
    daysAgo: 1,
    orders: 1,
    spentCents: 1290,
  },
  {
    id: 'u7',
    name: 'Primeur des Carmes',
    role: 'commercant',
    city: 'Toulouse · Carmes',
    daysAgo: 28,
    siret: '39876543200017',
    offers: 38,
    spentCents: 830000,
  },
  {
    id: 'u8',
    name: 'Sud Emballage',
    role: 'grossiste',
    city: 'Colomiers',
    daysAgo: 57,
    siret: '48765432100013',
    offers: 9,
    spentCents: 0,
  },
  {
    id: 'u9',
    name: 'Inès Fabre',
    role: 'consommateur',
    city: 'Toulouse · Capitole',
    daysAgo: 16,
    orders: 7,
    spentCents: 9450,
  },
  {
    id: 'u10',
    name: 'Pizzeria Napoli',
    role: 'commercant',
    city: 'Toulouse · Wilson',
    daysAgo: 22,
    siret: '',
    offers: 12,
    spentCents: 420000,
  },
  {
    id: 'u11',
    name: 'Nadia Cherif',
    role: 'consommateur',
    city: 'Toulouse · Empalot',
    daysAgo: 4,
    orders: 3,
    spentCents: 4180,
  },
  {
    id: 'u12',
    name: 'Textile Garonne',
    role: 'grossiste',
    city: 'Muret',
    daysAgo: 71,
    siret: '51234987600021',
    offers: 6,
    spentCents: 0,
  },
  {
    id: 'u13',
    name: 'Fromagerie Xavier',
    role: 'commercant',
    city: 'Toulouse · Capitole',
    daysAgo: 12,
    siret: '38901234500016',
    offers: 19,
    spentCents: 690000,
  },
  {
    id: 'u14',
    name: 'Marius Ortega',
    role: 'consommateur',
    city: 'Toulouse · Minimes',
    daysAgo: 30,
    orders: 15,
    spentCents: 21360,
  },
];

export const MEMBERS = RAW_MEMBERS.map((m) => ({
  ...m,
  siret: m.siret ?? '',
  offers: m.offers ?? 0,
  orders: m.orders ?? 0,
  joinedAt: now - m.daysAgo * DAY,
  /**
   * Un professionnel sans SIRET est « incomplet », pas suspendu : il peut
   * publier, mais le §5 lui interdit de commander chez un grossiste. C'est
   * exactement le genre de blocage que Farid doit voir d'un coup d'œil.
   */
  incomplete: m.role !== 'consommateur' && !m.siret,
}));

/** Six mois de volume, du plus ancien au plus récent. */
const RAW_MONTHS = [
  { label: 'mars', gmvCents: 412_000, packs: 2 },
  { label: 'avril', gmvCents: 587_000, packs: 4 },
  { label: 'mai', gmvCents: 703_000, packs: 3 },
  { label: 'juin', gmvCents: 934_000, packs: 7 },
  { label: 'juillet', gmvCents: 1_186_000, packs: 9 },
  { label: 'août', gmvCents: 642_000, packs: 5 },
];

/**
 * Le chiffre d'affaires DE LA PLATEFORME, mois par mois.
 *
 * Deux sources et elles ne se confondent pas : la commission du §21 (5 % du
 * volume vendu) et les packs du §9 (revenu récurrent, indépendant des ventes).
 * Les additionner sans les distinguer masquerait laquelle des deux tient
 * réellement l'entreprise.
 */
export const MONTHS = RAW_MONTHS.map((m) => {
  const commission = commissionCents(m.gmvCents);
  // Prix moyen d'un pack, faute de connaître lequel a été vendu.
  const packAvg = Math.round(PACKS.reduce((s, p) => s + p.priceCents, 0) / PACKS.length);
  const packsCents = m.packs * packAvg;
  return { ...m, commissionCents: commission, packsCents, revenueCents: commission + packsCents };
});

export const TOTALS = {
  members: MEMBERS.length,
  pros: MEMBERS.filter((m) => m.role !== 'consommateur').length,
  incomplete: MEMBERS.filter((m) => m.incomplete).length,
  gmvCents: MONTHS.reduce((s, m) => s + m.gmvCents, 0),
  commissionCents: MONTHS.reduce((s, m) => s + m.commissionCents, 0),
  packsCents: MONTHS.reduce((s, m) => s + m.packsCents, 0),
  packs: MONTHS.reduce((s, m) => s + m.packs, 0),
  offers: MEMBERS.reduce((s, m) => s + m.offers, 0),
};

TOTALS.revenueCents = TOTALS.commissionCents + TOTALS.packsCents;

export { COMMISSION_PCT };
