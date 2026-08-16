/**
 * Le cycle de vie d'une commande — CDC §11 et §12.
 *
 * Les dix statuts sont ceux du cahier des charges, dans son ordre. Le CDC
 * précise que « cette liste reste à valider » : les identifiants sont donc
 * neutres et la machine à états est isolée ici, pour qu'un changement de
 * vocabulaire ne se propage pas dans les écrans.
 *
 * ✅ Deux questions ouvertes le sont restées jusqu'aux schémas remis le
 * 16/08/2026 : le client y dessine lui-même « Acceptée » entre le paiement et
 * la préparation, et « En livraison » entre « Prête » et « Livrée ». Ce n'était
 * donc pas à nous d'arbitrer — c'était déjà tranché, dans un document qu'on
 * n'avait pas encore. Voir docs/product/parcours-clients.md.
 *
 * Ajouter une valeur à cet énum est SANS RISQUE pour les commandes déjà
 * stockées : les anciennes valeurs restent valides à la réhydratation. En
 * renommer une, en revanche, les effacerait toutes — c'est ce qui a failli
 * arriver avec « Click & Collect ».
 */

export const ORDER_STATUSES = [
  'panier',
  'creee',
  'paiement_attente',
  'payee',
  // Le commerçant a vu la commande et s'engage à la préparer. Le schéma du
  // client en fait une étape à part, et il a raison : entre « payée » et « en
  // préparation », le client attend sans savoir si quelqu'un l'a lue.
  'acceptee',
  'preparation',
  'prete',
  'en_livraison',
  'recuperee',
  'livree',
  // ─── États d'exception — CDC §5.2. Les schémas ne les montrent pas (ce sont
  // des visuels de parcours nominal), le cahier des charges les exige.
  'refusee',
  'annulee',
  'remboursement_en_cours',
  'remboursee',
  'litige',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
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

/**
 * Comment le client récupère sa commande — CDC V1.0 §5.3.
 *
 * « Touch & Collect » et non « Click & Collect » : le cahier des charges en fait
 * un INVARIANT — « cette terminologie doit remplacer Click & Collect dans les
 * écrans, notifications, interfaces professionnelles et documents produit ».
 * C'est un nom de marque, pas un synonyme : le laisser dériver fragmenterait
 * l'identité sur les seuls écrans que le client montre à ses commerçants.
 */
export const FULFILMENTS = ['touch-collect', 'livraison'] as const;
export type Fulfilment = (typeof FULFILMENTS)[number];

export const FULFILMENT_LABEL: Record<Fulfilment, string> = {
  'touch-collect': 'Touch & Collect',
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
  // Une commande payée que le commerçant REFUSE doit partir au remboursement :
  // l'argent est déjà pris. C'est le seul chemin honnête.
  payee: ['acceptee', 'refusee', 'annulee', 'remboursement_en_cours'],
  acceptee: ['preparation', 'annulee', 'remboursement_en_cours'],
  preparation: ['prete', 'annulee', 'remboursement_en_cours'],
  prete: ['recuperee', 'en_livraison', 'annulee'],
  en_livraison: ['livree', 'litige'],
  recuperee: ['remboursement_en_cours', 'litige'],
  livree: ['remboursement_en_cours', 'litige'],
  // Un refus laisse l'argent à rendre : il ne se termine pas sur lui-même.
  refusee: ['remboursement_en_cours'],
  // Une commande annulée après paiement doit encore pouvoir être remboursée.
  annulee: ['remboursement_en_cours'],
  // Le remboursement est un ÉTAT, pas un instant : entre la décision et le
  // virement il se passe des jours, et le client doit voir cette attente
  // plutôt qu'un « remboursée » qui ment sur son compte en banque.
  remboursement_en_cours: ['remboursee'],
  remboursee: [],
  // Un litige se résout dans un sens ou dans l'autre — il ne s'enterre pas.
  litige: ['remboursement_en_cours', 'recuperee', 'livree'],
};

/**
 * Les suites possibles depuis ce statut, pour ce mode de retrait.
 *
 * Une commande en Touch & Collect ne peut pas être « livrée », et une commande
 * en livraison ne peut pas être « récupérée » : ce sont deux fins de parcours
 * distinctes, pas deux mots pour la même chose.
 */
export function nextStatuses(status: OrderStatus, fulfilment: Fulfilment): OrderStatus[] {
  const all = TRANSITIONS[status];
  if (status !== 'prete') return all;
  // En livraison, « prête » mène au livreur — pas directement chez le client.
  const end: OrderStatus = fulfilment === 'touch-collect' ? 'recuperee' : 'en_livraison';
  return all.filter((s) => s === end || s === 'annulee');
}

export function canTransition(from: OrderStatus, to: OrderStatus, fulfilment: Fulfilment): boolean {
  return nextStatuses(from, fulfilment).includes(to);
}

/** Un statut d'où l'on ne bouge plus. */
export function isFinal(status: OrderStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

/**
 * La commande est-elle encore en cours, du point de vue du client ?
 *
 * Un litige et un remboursement en cours comptent pour « en cours » : ce sont
 * exactement les commandes qu'on veut retrouver en haut de sa liste, pas
 * classées avec celles qui sont réglées.
 */
export function isActive(status: OrderStatus): boolean {
  const termines: OrderStatus[] = ['recuperee', 'livree', 'refusee', 'annulee', 'remboursee'];
  return !termines.includes(status);
}

/** Le parcours nominal affiché au client, selon son mode de retrait. */
export function timelineFor(fulfilment: Fulfilment): OrderStatus[] {
  return [
    'creee',
    'paiement_attente',
    'payee',
    'acceptee',
    'preparation',
    'prete',
    // La livraison a une étape de plus que le retrait, et c'est la plus
    // attendue de tout le parcours : « c'est parti, ça arrive ».
    ...(fulfilment === 'touch-collect'
      ? (['recuperee'] as OrderStatus[])
      : (['en_livraison', 'livree'] as OrderStatus[])),
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
  acceptee: 'encours',
  preparation: 'encours',
  prete: 'encours',
  en_livraison: 'encours',
  recuperee: 'succes',
  livree: 'succes',
  refusee: 'echec',
  annulee: 'echec',
  // Un remboursement en cours n'est pas un échec pour le client : c'est de
  // l'attente, et son argent revient. Le peindre en rouge l'inquiéterait sans
  // raison — le rouge est réservé à ce qui a définitivement mal tourné.
  remboursement_en_cours: 'attente',
  remboursee: 'echec',
  litige: 'echec',
};
