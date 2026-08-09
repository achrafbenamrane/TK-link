/**
 * Le cycle de vie d'une commande — CDC §11 et §12.
 *
 * Les dix statuts sont ceux du cahier des charges, dans son ordre. Le CDC
 * précise que « cette liste reste à valider » : les identifiants sont donc
 * neutres et la machine à états est isolée ici, pour qu'un changement de
 * vocabulaire ne se propage pas dans les écrans.
 *
 * ⚠️ Manque à la liste du CDC : un statut « en cours de livraison », entre
 * « prête » et « livrée ». L'app le montrait déjà (suivi du livreur). En
 * attendant l'arbitrage de Farid, une commande confiée au livreur reste
 * « prête » — voir la question remontée dans le plan de conformité.
 */

export const ORDER_STATUSES = [
  'panier',
  'creee',
  'paiement_attente',
  'payee',
  'preparation',
  'prete',
  'recuperee',
  'livree',
  'annulee',
  'remboursee',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
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

/** Comment le client récupère sa commande — CDC §12. */
export const FULFILMENTS = ['click-collect', 'livraison'] as const;
export type Fulfilment = (typeof FULFILMENTS)[number];

export const FULFILMENT_LABEL: Record<Fulfilment, string> = {
  'click-collect': 'Click & Collect',
  livraison: 'Livraison',
};

/**
 * Transitions autorisées.
 *
 * Une machine à états explicite plutôt qu'un simple champ libre : sans elle,
 * rien n'empêche une commande de passer de « remboursée » à « en préparation »,
 * et un bug d'affichage devient un bug comptable.
 *
 * `prete` est le seul point où le mode de retrait décide de la suite — d'où
 * `nextStatuses`, qui en tient compte.
 */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  panier: ['creee', 'annulee'],
  creee: ['paiement_attente', 'annulee'],
  paiement_attente: ['payee', 'annulee'],
  payee: ['preparation', 'annulee', 'remboursee'],
  preparation: ['prete', 'annulee'],
  prete: ['recuperee', 'livree', 'annulee'],
  recuperee: ['remboursee'],
  livree: ['remboursee'],
  // Une commande annulée après paiement doit encore pouvoir être remboursée.
  annulee: ['remboursee'],
  remboursee: [],
};

/**
 * Les suites possibles depuis ce statut, pour ce mode de retrait.
 *
 * Une commande en Click & Collect ne peut pas être « livrée », et une commande
 * en livraison ne peut pas être « récupérée » : ce sont deux fins de parcours
 * distinctes, pas deux mots pour la même chose.
 */
export function nextStatuses(status: OrderStatus, fulfilment: Fulfilment): OrderStatus[] {
  const all = TRANSITIONS[status];
  if (status !== 'prete') return all;
  const end: OrderStatus = fulfilment === 'click-collect' ? 'recuperee' : 'livree';
  return all.filter((s) => s === end || s === 'annulee');
}

export function canTransition(from: OrderStatus, to: OrderStatus, fulfilment: Fulfilment): boolean {
  return nextStatuses(from, fulfilment).includes(to);
}

/** Un statut d'où l'on ne bouge plus. */
export function isFinal(status: OrderStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

/** La commande est-elle encore en cours, du point de vue du client ? */
export function isActive(status: OrderStatus): boolean {
  return !['recuperee', 'livree', 'annulee', 'remboursee'].includes(status);
}

/** Le parcours nominal affiché au client, selon son mode de retrait. */
export function timelineFor(fulfilment: Fulfilment): OrderStatus[] {
  return [
    'creee',
    'paiement_attente',
    'payee',
    'preparation',
    'prete',
    fulfilment === 'click-collect' ? 'recuperee' : 'livree',
  ];
}

/**
 * Où en est la commande sur sa frise, ou `null` si elle en est sortie
 * (annulée, remboursée) — ces deux-là ne sont pas une étape du parcours
 * nominal, les afficher comme telle serait mentir sur l'avancement.
 */
export function timelineIndex(status: OrderStatus, fulfilment: Fulfilment): number | null {
  const index = timelineFor(fulfilment).indexOf(status);
  return index === -1 ? null : index;
}

/** Le ton à donner au statut — pilote la couleur de la pastille. */
export type StatusTone = 'attente' | 'encours' | 'succes' | 'echec';

export const STATUS_TONE: Record<OrderStatus, StatusTone> = {
  panier: 'attente',
  creee: 'attente',
  paiement_attente: 'attente',
  payee: 'encours',
  preparation: 'encours',
  prete: 'encours',
  recuperee: 'succes',
  livree: 'succes',
  annulee: 'echec',
  remboursee: 'echec',
};
