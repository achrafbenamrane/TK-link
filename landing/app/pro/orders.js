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
  acceptee: 'Acceptée',
  preparation: 'En préparation',
  prete: 'Prête',
  en_livraison: 'En livraison',
  recuperee: 'Récupérée',
  livree: 'Livrée',
  refusee: 'Refusée',
  annulee: 'Annulée',
  remboursement_en_cours: 'Remboursement en cours',
  remboursee: 'Remboursée',
  litige: 'Litige',
};

/** Transitions autorisées — identiques à celles de l'app. */
const TRANSITIONS = {
  panier: ['creee', 'annulee'],
  creee: ['paiement_attente', 'annulee'],
  paiement_attente: ['payee', 'annulee'],
  payee: ['acceptee', 'refusee', 'annulee', 'remboursement_en_cours'],
  acceptee: ['preparation', 'annulee', 'remboursement_en_cours'],
  preparation: ['prete', 'annulee', 'remboursement_en_cours'],
  prete: ['recuperee', 'en_livraison', 'annulee'],
  en_livraison: ['livree', 'litige'],
  recuperee: ['remboursement_en_cours', 'litige'],
  livree: ['remboursement_en_cours', 'litige'],
  refusee: ['remboursement_en_cours'],
  annulee: ['remboursement_en_cours'],
  remboursement_en_cours: ['remboursee'],
  remboursee: [],
  litige: ['remboursement_en_cours', 'recuperee', 'livree'],
};

/** Ce que le commerçant doit faire ensuite, dit avec ses mots à lui. */
export const ACTION_LABEL = {
  preparation: 'En préparation',
  prete: 'C’est prêt',
  recuperee: 'Remise au client',
  livree: 'Livrée',
  en_livraison: 'Remise au livreur',
  refusee: 'Refuser',
  litige: 'Ouvrir un litige',
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
  return !['recuperee', 'livree', 'refusee', 'annulee', 'remboursee'].includes(status);
}

/**
 * LES GESTES DU COMMERÇANT — les MÊMES sur toutes les commandes.
 *
 * Avant, chaque carte affichait les transitions autorisées par son statut : une
 * commande payée montrait trois boutons, une commande prête en montrait deux
 * autres, une commande terminée un troisième. Retour de la conduite de projet
 * le 18/08 : « c'est pas cohérent que chaque commande ait des boutons
 * différents ». Elle a raison — un tableau de bord n'est pas un cours sur la
 * machine à états, et un commerçant en plein service doit trouver le même geste
 * au même endroit sur toutes ses commandes.
 *
 * Les gestes sont donc FIXES et leur ordre ne change jamais ; seul leur état
 * actif varie. On lit la progression d'un coup d'œil, sans lire les libellés.
 *
 * Deux règles portées par le même retour :
 *
 * — Plus de bouton « Rembourser ». Le remboursement n'est pas un geste, c'est
 *   une CONSÉQUENCE : refuser une commande déjà payée déclenche le
 *   remboursement, la machine à états ne laisse d'ailleurs pas d'autre issue à
 *   `refusee`. Un bouton séparé laissait croire qu'on pouvait refuser sans
 *   rendre l'argent.
 * — Sur une commande terminée, « Ouvrir un litige » remplace « Rembourser ».
 *   Ce qui arrive après une remise, ce n'est pas un remboursement spontané,
 *   c'est une réclamation — et c'est elle qui décide, ensuite, du remboursement.
 */
export function merchantActions(status, fulfilment) {
  if (!isActive(status)) {
    return [{ target: 'litige', tone: 'ghost', enabled: status !== 'litige' }];
  }

  // Touch & Collect se termine par une remise en main propre, la livraison par
  // un passage au livreur : deux fins distinctes, jamais deux mots pour la même.
  const fin = fulfilment === 'touch-collect' ? 'recuperee' : 'en_livraison';

  return [
    {
      target: 'preparation',
      tone: 'primary',
      enabled: canReach(status, 'preparation', fulfilment),
    },
    { target: 'prete', tone: 'primary', enabled: canReach(status, 'prete', fulfilment) },
    { target: fin, tone: 'primary', enabled: canReach(status, fin, fulfilment) },
    { target: 'refusee', tone: 'ghost', enabled: canReach(status, 'refusee', fulfilment) },
  ];
}

/**
 * Le chemin à parcourir pour atteindre ce statut — une étape, ou deux.
 *
 * « Acceptée » est un statut du schéma remis par le client, entre le paiement
 * et la préparation. Mais aucun commerçant ne pense « j'accepte » puis « je
 * prépare » : il commence à préparer, et l'acceptation est implicite. Mettre en
 * préparation depuis « payée » enregistre donc les DEUX transitions d'un seul
 * geste — le modèle reste fidèle au schéma, l'interface reste fidèle au métier.
 */
export function pathTo(status, target, fulfilment) {
  if (canTransition(status, target, fulfilment)) return [target];
  for (const intermediaire of nextStatuses(status, fulfilment)) {
    if (canTransition(intermediaire, target, fulfilment)) return [intermediaire, target];
  }
  return [];
}

/** Ce geste est-il possible, directement ou en passant par une étape ? */
function canReach(status, target, fulfilment) {
  return pathTo(status, target, fulfilment).length > 0;
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
