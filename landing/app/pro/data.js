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

/**
 * LES OFFRES DU COMMERÇANT — mêmes données que la carte de l'app.
 *
 * La version précédente ne portait qu'une accroche (« -20 % ») et une audience.
 * Retour de la conduite de projet le 18/08 : « c'est un tableau pour gérer ses
 * offres, là on peut pas y faire grand-chose ; on essaye de donner une
 * interface réaliste au client maintenant, plus un prototype ».
 *
 * Chaque offre porte donc ce que le §3.1 du CDC exige sur la carte client :
 * photo, prix initial ET prix flash, quantité restante sur quantité initiale,
 * et une fin datée. Le commerçant voit ce que son client voit — c'est la seule
 * façon de savoir ce qu'on publie.
 *
 * `endsAt` est calculé au chargement, pas figé : des dates en dur feraient
 * vieillir la démonstration et afficheraient des offres expirées.
 */
export const OFFERS = [
  {
    id: 'o1',
    title: 'Formule déjeuner',
    photo: '/offre/d_brunch.jpg',
    category: 'restauration',
    oldPriceCents: 1690,
    priceCents: 1190,
    stockTotal: 40,
    stockLeft: 12,
    endsInMinutes: 95,
    live: true,
  },
  {
    id: 'o2',
    title: 'Happy hour 17 h – 19 h',
    photo: '/offre/d_pizza.jpg',
    category: 'restauration',
    oldPriceCents: 1200,
    priceCents: 750,
    stockTotal: 25,
    stockLeft: 4,
    endsInMinutes: 38,
    live: true,
  },
  {
    id: 'o3',
    title: 'Brunch du dimanche',
    photo: '/offre/d_cassoulet.jpg',
    category: 'restauration',
    oldPriceCents: 2400,
    priceCents: 1800,
    stockTotal: 30,
    stockLeft: 18,
    endsInMinutes: 240,
    live: true,
  },
  {
    id: 'o4',
    title: 'Panier viennoiseries',
    photo: '/offre/d_viennoiseries.jpg',
    category: 'restauration',
    oldPriceCents: 1100,
    priceCents: 450,
    stockTotal: 15,
    stockLeft: 15,
    endsInMinutes: 15,
    live: false,
  },
].map((o) => ({ ...o, endsAt: Date.now() + o.endsInMinutes * 60 * 1000 }));

/** La remise, en pourcent — jamais stockée : elle se déduit des deux prix. */
export function discountPct(offer) {
  if (!offer.oldPriceCents || offer.oldPriceCents <= offer.priceCents) return 0;
  return Math.round((1 - offer.priceCents / offer.oldPriceCents) * 100);
}

/**
 * Le temps restant, en « 01:23:45 ».
 *
 * Toujours trois blocs, même sous l'heure : « 04:31 » se lit aussi bien quatre
 * minutes que quatre heures, et c'est l'urgence qu'on perd à l'ambiguïté.
 */
export function remainingLabel(endsAt, now = Date.now()) {
  const total = Math.max(0, Math.floor((endsAt - now) / 1000));
  const p = (n) => String(n).padStart(2, '0');
  return `${p(Math.floor(total / 3600))}:${p(Math.floor((total % 3600) / 60))}:${p(total % 60)}`;
}

/* ------------------------------------------------- performance par Flash
 *
 * CDC V1.0 §11.3 : le commerçant doit voir, pour chaque opération, les vues,
 * la quantité initiale / vendue / restante, le chiffre d'affaires généré, la
 * durée avant épuisement, le taux de conversion et la répartition entre
 * Touch & Collect et livraison.
 *
 * Le document dit pourquoi, et c'est l'argument commercial de TK LINK :
 * « le commerçant doit pouvoir répondre objectivement à — qu'est-ce que TKLINK
 * m'a rapporté ? ». Sans ces chiffres, la conversion vers les offres payantes
 * repose sur une impression.
 *
 * ⚠️ Données SIMULÉES, comme tout ce portail. Les vues, en particulier, ne
 * peuvent venir que d'un back-end : le §12.2 en fait la source de vérité.
 */
export const FLASH_STATS = [
  {
    id: 'o1',
    title: 'Formule déjeuner',
    views: 412,
    initial: 40,
    sold: 37,
    revenueCents: 44_030,
    /** Minutes écoulées entre la publication et l'épuisement. `null` = pas épuisé. */
    soldOutInMin: 74,
    touchCollect: 29,
    delivery: 8,
  },
  {
    id: 'o2',
    title: 'Happy hour 17 h – 19 h',
    views: 268,
    initial: 25,
    sold: 25,
    revenueCents: 18_750,
    soldOutInMin: 41,
    touchCollect: 25,
    delivery: 0,
  },
  {
    id: 'o3',
    title: 'Brunch du dimanche',
    views: 197,
    initial: 30,
    sold: 12,
    revenueCents: 21_600,
    soldOutInMin: null,
    touchCollect: 7,
    delivery: 5,
  },
];

/** Ce qu'il reste : la quantité initiale moins ce qui est parti. */
export const remaining = (s) => Math.max(0, s.initial - s.sold);

/**
 * Le taux de conversion, en pourcent — ventes rapportées aux vues.
 *
 * Zéro vue donne zéro, jamais une division par zéro : une offre publiée il y a
 * dix secondes ne doit pas afficher « Infinity % ».
 */
export const conversionPct = (s) => (s.views > 0 ? Math.round((s.sold / s.views) * 100) : 0);

/** « 1 h 14 » ou « — » tant que l'offre n'est pas épuisée. */
export function formatSoldOut(min) {
  if (min === null || min === undefined) return '—';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

/* ------------------------------------------------------- le commerce
 *
 * Les informations que le §5 du CDC collecte à l'inscription, plus celles que
 * le §4.2 étape 7 demande pour paramétrer la boutique. La conduite de projet
 * les réclame réunies au même endroit : « ajoute une partie mon profil pour que
 * le commerçant gère ses données personnelles, adresse du magasin, KBIS fourni
 * lors de l'inscription, logo, nom du magasin… toutes les infos du commerce ».
 *
 * ⚠️ Données de DÉMONSTRATION. Le §12.2 fait du serveur la source de vérité :
 * ce qui est édité ici ne survivra pas à un rechargement tant qu'il n'existe
 * pas — et l'écran le dit, plutôt que de laisser croire à un enregistrement.
 */
export const MERCHANT = {
  shopName: 'Le Comptoir du Midi',
  legalName: 'SARL Comptoir du Midi',
  logo: '/offre/d_brunch.jpg',
  category: 'restauration',
  siret: '812 345 678 00021',
  tva: 'FR32812345678',
  address: '12 rue des Filatiers',
  zip: '31000',
  city: 'Toulouse',
  area: 'Carmes',
  contactName: 'Farid Terki',
  email: 'contact@comptoir-du-midi.fr',
  phone: '05 61 23 45 67',
  iban: 'FR76 •••• •••• •••• •••• 4821',
  hours: 'Lun–Sam · 11 h 30 – 22 h',
  fulfilments: ['touch-collect', 'livraison'],
  /**
   * Le KBIS déposé à l'inscription — §5 du CDC, et pièce que le Super Admin
   * examine pour valider le compte. Il se consulte, il ne se réécrit pas :
   * remplacer un justificatif d'immatriculation n'est pas une modification de
   * profil, c'est une nouvelle demande de validation.
   */
  kbis: {
    filename: 'kbis-comptoir-du-midi.pdf',
    uploadedAt: '13/08/2026',
    status: 'validé',
  },
};
