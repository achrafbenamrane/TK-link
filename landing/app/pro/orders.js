/**
 * Les commandes reçues — CDC §11 et §18, côté web.
 *
 * ⚠️ MIROIR de `src/features/shop/lib/order-status.ts`. Les dix statuts et
 * leurs transitions sont ceux du cahier des charges : le web et l'app doivent
 * autoriser EXACTEMENT les mêmes gestes, sinon un commerçant qui passe de son
 * comptoir à son ordinateur verrait deux réalités différentes de la même
 * commande. Toute modification ici doit être reportée là-bas, et réciproquement.
 *
 * Le jour où l'API existe, statuts et transitions viendront du serveur et ce
 * fichier se réduit aux libellés.
 */

const MINUTE = 60 * 1000;
const now = Date.now();

export const ORDER_STATUS_LABEL = {
  panier: 'Panier',
  creee: 'Commande créée',
  paiement_attente: 'Paiement en attente',
  payee: 'Payée',
  preparation: 'En préparation',
  prete: 'Prête',
  recuperee: 'Récupérée',
  livree: 'Livrée',
  annulee: 'Annulée',
  remboursee: 'Remboursée',
};

/** Transitions autorisées — identiques à celles de l'app. */
const TRANSITIONS = {
  panier: ['creee', 'annulee'],
  creee: ['paiement_attente', 'annulee'],
  paiement_attente: ['payee', 'annulee'],
  payee: ['preparation', 'annulee', 'remboursee'],
  preparation: ['prete', 'annulee'],
  prete: ['recuperee', 'livree', 'annulee'],
  recuperee: ['remboursee'],
  livree: ['remboursee'],
  annulee: ['remboursee'],
  remboursee: [],
};

/** Ce que le commerçant doit faire ensuite, dit avec ses mots à lui. */
export const ACTION_LABEL = {
  payee: 'Accepter',
  preparation: 'En préparation',
  prete: 'C’est prêt',
  recuperee: 'Remise au client',
  livree: 'Livrée',
  annulee: 'Refuser',
  remboursee: 'Rembourser',
};

/**
 * Les suites possibles. Une commande en Touch & Collect ne peut pas être
 * « livrée », et une commande en livraison ne peut pas être « récupérée » :
 * deux fins de parcours distinctes, pas deux mots pour la même chose.
 */
export function nextStatuses(status, fulfilment) {
  const all = TRANSITIONS[status] ?? [];
  if (status !== 'prete') return all;
  const end = fulfilment === 'touch-collect' ? 'recuperee' : 'livree';
  return all.filter((s) => s === end || s === 'annulee');
}

export function canTransition(from, to, fulfilment) {
  return nextStatuses(from, fulfilment).includes(to);
}

/** La commande est-elle encore en cours ? */
export function isActive(status) {
  return !['recuperee', 'livree', 'annulee', 'remboursee'].includes(status);
}

/** Commandes de démonstration — même forme que `OrderSchema` côté app. */
export const ORDERS = [
  {
    id: 'TK-4821',
    customer: 'Sofiane B.',
    minutesAgo: 4,
    fulfilment: 'touch-collect',
    status: 'payee',
    lines: [
      { label: 'Plateau de viennoiseries', qty: 2, unitCents: 900 },
      { label: 'Café', qty: 1, unitCents: 220 },
    ],
  },
  {
    id: 'TK-4820',
    customer: 'Claire M.',
    minutesAgo: 17,
    fulfilment: 'livraison',
    status: 'preparation',
    lines: [{ label: 'Formule déjeuner', qty: 1, unitCents: 1690 }],
  },
  {
    id: 'TK-4819',
    customer: 'Yanis T.',
    minutesAgo: 38,
    fulfilment: 'touch-collect',
    status: 'prete',
    lines: [{ label: 'Panier anti-gaspi', qty: 1, unitCents: 490 }],
  },
  {
    id: 'TK-4818',
    customer: 'Inès F.',
    minutesAgo: 96,
    fulfilment: 'touch-collect',
    status: 'recuperee',
    lines: [{ label: 'Brunch du dimanche', qty: 2, unitCents: 1450 }],
  },
  {
    id: 'TK-4817',
    customer: 'Marius O.',
    minutesAgo: 140,
    fulfilment: 'livraison',
    status: 'annulee',
    lines: [{ label: 'Menu du jour', qty: 1, unitCents: 1450 }],
  },
].map((o) => ({
  ...o,
  placedAt: now - o.minutesAgo * MINUTE,
  totalCents: o.lines.reduce((s, l) => s + l.unitCents * l.qty, 0),
}));

/** « il y a 4 min » — plus parlant qu'une heure quand tout se joue en minutes. */
export function sinceLabel(placedAt, reference = Date.now()) {
  const minutes = Math.max(0, Math.round((reference - placedAt) / MINUTE));
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `il y a ${hours} h`;
}
