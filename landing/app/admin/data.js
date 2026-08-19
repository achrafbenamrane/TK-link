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

/* ------------------------------------------------------ demandes d'inscription
 *
 * Les professionnels ne rejoignent pas la plateforme tout seuls : un humain
 * regarde leur dossier avant de leur ouvrir la porte. Sans ce filtre, n'importe
 * qui publie des ventes flash au nom d'un commerce qui n'est pas le sien.
 *
 * Chaque dossier porte donc son justificatif — un Kbis pour une société — que
 * l'administrateur doit pouvoir OUVRIR avant de trancher. Un bouton « accepter »
 * sans document à lire ne serait qu'un bouton.
 *
 * ⚠️ Dossiers simulés. Le PDF joint est une démonstration filigranée, sans
 * valeur juridique ; le vrai document sera téléversé par le demandeur.
 */
export const APPLICATIONS = [
  {
    id: 'app_1',
    shop: 'Maison Hammamet',
    contact: 'Karim Ben Salah',
    email: 'karim@maison-hammamet.fr',
    phone: '06 21 45 09 33',
    role: 'commercant',
    activity: 'Boucherie · charcuterie',
    siret: '89321450700018',
    address: '24 avenue Jean Baylet, 31100 Toulouse',
    submittedAt: '2026-08-12T09:14:00',
    document: { name: 'Extrait Kbis — Maison Hammamet', href: '/demo/kbis-maison-hammamet.pdf' },
  },
  {
    id: 'app_2',
    shop: 'Techno Sud',
    contact: 'Lucie Marchand',
    email: 'contact@technosud.fr',
    phone: '05 61 22 88 40',
    role: 'commercant',
    activity: 'High-tech · reconditionné',
    siret: '80412339500027',
    address: '8 rue du Taur, 31000 Toulouse',
    submittedAt: '2026-08-12T16:02:00',
    document: { name: 'Extrait Kbis — Techno Sud', href: '/demo/kbis-maison-hammamet.pdf' },
  },
  {
    id: 'app_3',
    shop: 'Grossiste Occitan',
    contact: 'Paul Rives',
    email: 'p.rives@grossiste-occitan.fr',
    phone: '05 34 77 12 05',
    role: 'grossiste',
    activity: 'Fruits et légumes · gros',
    // SIRET volontairement absent : le dossier est incomplet, et l'écran doit
    // le montrer AVANT que quelqu'un ne l'accepte par réflexe.
    siret: '',
    address: 'MIN de Toulouse, 31200 Toulouse',
    submittedAt: '2026-08-13T07:41:00',
    document: null,
  },
];

/** Motifs de refus les plus fréquents — un clic vaut mieux qu'une phrase à écrire. */
export const REFUSAL_REASONS = [
  'Kbis illisible ou absent',
  'SIRET non renseigné',
  'Activité hors périmètre',
  'Coordonnées invérifiables',
];

/* ------------------------------------------------------------------ litiges
 *
 * Les cas viennent du CDC §22, qui les énumère sans les trancher : « client
 * absent, commerçant indisponible, commande incorrecte, produit manquant ou
 * incorrect, retard, annulation, problème de paiement, problème de livraison ».
 * Le document ajoute que ces situations « devront être précisées avec Farid » —
 * l'écran les rend donc VISIBLES et traçables, sans inventer de règle
 * d'arbitrage automatique qui n'a pas été validée.
 *
 * Le montant est celui de la commande : c'est lui qui décide de l'urgence, un
 * litige à 4 € et un litige à 90 € ne s'instruisent pas de la même façon.
 */
export const DISPUTE_KINDS = {
  absent: 'Client absent',
  indisponible: 'Commerçant indisponible',
  incorrecte: 'Commande incorrecte',
  manquant: 'Produit manquant ou incorrect',
  retard: 'Retard',
  annulation: 'Annulation',
  paiement: 'Problème de paiement',
  livraison: 'Problème de livraison',
};

export const DISPUTES = [
  {
    id: 'lit_1',
    kind: 'manquant',
    order: 'CMD-2026-0841',
    merchant: 'Maison Hammamet',
    customer: 'Sofiane Belkacem',
    amountCents: 2490,
    openedAt: '2026-08-13T08:12:00',
    message:
      'Deux pièces annoncées, une seule dans le sachet. Photo du contenu jointe à la commande.',
  },
  {
    id: 'lit_2',
    kind: 'retard',
    order: 'CMD-2026-0838',
    merchant: 'Le Comptoir du Midi',
    customer: 'Claire Mounier',
    amountCents: 1780,
    openedAt: '2026-08-12T19:40:00',
    message: 'Livraison annoncée à 19 h, reçue à 21 h 15. Le plat était froid.',
  },
  {
    id: 'lit_3',
    kind: 'paiement',
    order: 'CMD-2026-0829',
    merchant: 'Techno Sud',
    customer: 'Yanis Legrand',
    amountCents: 8900,
    openedAt: '2026-08-11T14:05:00',
    message: 'Montant débité deux fois. Le client demande le remboursement du doublon.',
  },
  {
    id: 'lit_4',
    kind: 'absent',
    order: 'CMD-2026-0812',
    merchant: 'Cinéma Le Lumière',
    customer: 'Inès Fabre',
    amountCents: 490,
    openedAt: '2026-08-10T22:50:00',
    message: 'Place non retirée avant la séance. Le commerçant refuse le remboursement.',
  },
];

/** Ce qu'un administrateur peut décider. Trois issues, pas davantage. */
export const DISPUTE_OUTCOMES = [
  { key: 'refund', label: 'Rembourser le client', tone: 'ko' },
  { key: 'merchant', label: 'Donner raison au commerçant', tone: 'ok' },
  { key: 'gesture', label: 'Geste commercial', tone: 'mid' },
];

/* ------------------------------------------------- messagerie support
 *
 * Le pendant, côté administration, de l'onglet Contact des espaces pro et
 * grossiste : « ajoute aussi une partie contact pour pouvoir échanger avec
 * commerçants et grossistes si besoin ».
 *
 * Une messagerie n'a de valeur que si elle est BILATÉRALE. Un formulaire qui
 * envoie dans le vide et une administration qui répond par e-mail en dehors de
 * la plateforme, c'est une conversation coupée en deux : personne ne retrouve
 * l'historique, et le professionnel ne sait pas si son message est arrivé.
 *
 * ⚠️ Fils simulés. Le §12.2 fait du serveur la source de vérité — ce qui est
 * écrit ici ne quitte pas la page.
 */
export const THREADS = [
  {
    id: 'th_1',
    party: 'Maison Hammamet',
    role: 'commercant',
    subject: 'Paiement ou versement',
    unread: true,
    messages: [
      {
        id: 'th1_m1',
        from: 'pro',
        at: 'Aujourd’hui · 09 h 41',
        body: 'Bonjour, la vente de samedi n’apparaît pas sur mon relevé de versement. Commande TK-4802, 48,60 €.',
      },
    ],
  },
  {
    id: 'th_2',
    party: 'Occitanie Fruits & Légumes',
    role: 'grossiste',
    subject: 'Publication d’une offre',
    unread: false,
    messages: [
      {
        id: 'th2_m1',
        from: 'pro',
        at: 'Hier · 15 h 08',
        body: 'Je n’arrive pas à publier un lot de 200 kg : le champ quantité refuse au-delà de 99.',
      },
      {
        id: 'th2_m2',
        from: 'admin',
        at: 'Hier · 16 h 22',
        body: 'Bonjour, la limite est corrigée depuis ce matin. Pouvez-vous réessayer et nous confirmer ?',
      },
    ],
  },
  {
    id: 'th_3',
    party: 'Techno Sud',
    role: 'commercant',
    subject: 'Mon compte et mes documents',
    unread: true,
    messages: [
      {
        id: 'th3_m1',
        from: 'pro',
        at: 'Lundi · 11 h 03',
        body: 'Mon Kbis a été refusé mais je ne comprends pas pourquoi, il date de moins de trois mois.',
      },
    ],
  },
];
