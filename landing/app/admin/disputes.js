/**
 * Les litiges, côté back-office : les commandes du serveur en « litige » (migration 0012), mises en
 * forme pour l'onglet Litiges de `/admin`, et la décision qui les tranche (migration 0021). Pur,
 * testé par `landing/__tests__/admin-disputes.test.ts`.
 */

/** Les issues proposées (mêmes clés que `DISPUTE_OUTCOMES` de data.js). */
export const OUTCOMES = ['refund', 'merchant', 'gesture'];

/**
 * Le statut d'une commande en litige après la décision.
 * - Rembourser : « remboursement en cours » — le remboursement part alors TOUT SEUL chez Stripe
 *   (migration 0027, fonction `order-refund`) et le webhook la passe « remboursée » (le crédit de
 *   parrainage pris revient alors de lui-même). S'il ne peut pas partir, la commande revient en
 *   litige avec la raison (`refundFailure`).
 * - Donner raison au commerçant, ou geste commercial (remboursement partiel fait dans Stripe) : la
 *   commande est HONORÉE — « livrée » ou « récupérée » (points de fidélité crédités).
 */
export function statusAfter(outcome, fulfilment) {
  if (outcome === 'refund') return 'remboursement_en_cours';
  if (outcome === 'merchant' || outcome === 'gesture') {
    return fulfilment === 'livraison' ? 'livree' : 'recuperee';
  }
  return null;
}

/** Un motif de décision : 3 à 500 caractères (la base le vérifie aussi). `null` sinon. */
export function validNote(note) {
  const text = String(note ?? '').trim();
  return text.length >= 3 && text.length <= 500 ? text : null;
}

/** « #TKL-4A1B2C », comme dans l'app. */
export function orderRef(id) {
  return `#TKL-${String(id).slice(-6).toUpperCase()}`;
}

/**
 * Le genre de litige (clés de `DISPUTE_KINDS`) : une contestation bancaire, puis le motif choisi par
 * le client dans l'app (0027), puis la course et la demande au support.
 */
export function disputeKind(order, ticket) {
  if (order.stripe_dispute_id) return 'paiement';
  if (order.issue_kind === 'non_conforme') return 'manquant';
  if (order.issue_kind === 'non_recue') {
    return order.fulfilment === 'livraison' ? 'livraison' : 'indisponible';
  }
  if (order.uber_status === 'canceled' || order.uber_status === 'returned') return 'livraison';
  if (ticket?.category === 'livraison') return 'livraison';
  if (ticket?.category === 'commande') return 'manquant';
  return 'paiement';
}

const DEFAULT_MESSAGE = {
  livraison: 'La course Uber Direct a échoué après le paiement (annulée ou colis revenu).',
  paiement:
    'Paiement reçu après l’expiration de la réservation : le stock a pu être rendu entre-temps.',
  manquant: 'Le client signale un problème sur sa commande.',
};

/** Le motif choisi par le client dans l'app (« Signaler un problème », 0027). */
const ISSUE_MESSAGE = {
  non_recue:
    'Le client signale ne pas avoir reçu sa commande (après la remise au retrait ou au coursier).',
  non_conforme: 'Le client signale un produit incomplet ou non conforme à l’offre.',
  autre: 'Le client signale un autre problème (commerçant, livraison ou paiement).',
};

const CHARGEBACK_MESSAGE =
  'Le client conteste le paiement auprès de sa banque. À traiter dans Stripe (Connect → le compte du commerce → Litiges) avant l’échéance indiquée.';

/**
 * Pourquoi le remboursement automatique n'est pas parti (0027, `refund_failure`), en clair — `null`
 * s'il n'y a rien à signaler.
 */
export function refundFailureText(code) {
  if (!code) return null;
  const [kind, detail] = String(code).split(':');
  const why = {
    stripe_not_configured: 'Stripe n’est pas encore branché sur le serveur',
    no_payment: 'la commande ne porte aucun paiement Stripe',
    no_account: 'le commerce n’a pas de compte Stripe',
    courier_active: 'un coursier Uber Direct est encore en route — annulez la course d’abord',
    refund_failed: `Stripe n’a pas pu rendre l’argent${detail ? ` (${detail})` : ''}`,
    stripe_failed: `Stripe a refusé ou n’a pas répondu${detail ? ` (${detail})` : ''}`,
  }[kind];
  return `Le remboursement automatique n’est pas parti : ${why ?? code}. À faire dans Stripe.`;
}

/**
 * Les litiges prêts à afficher, et les décisions déjà prises (`{ [id]: { outcome, note } }`).
 * Le message est le dernier écrit par le client dans la demande au support liée à la commande ; sans
 * demande, une explication tirée de la commande elle-même.
 */
export function toDisputes(orders, shops, profiles, tickets) {
  const shopById = new Map((shops ?? []).map((s) => [s.id, s]));
  const personById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const ticketByOrder = new Map();
  for (const t of tickets ?? []) {
    if (t.order_id && !ticketByOrder.has(t.order_id)) ticketByOrder.set(t.order_id, t);
  }

  const disputes = [];
  const rulings = {};
  for (const o of orders ?? []) {
    const shop = shopById.get(o.shop_id);
    const who = personById.get(o.customer_id);
    const ticket = ticketByOrder.get(o.id);
    const lastFromCustomer = [...(ticket?.support_messages ?? [])]
      .filter((m) => !m.from_staff)
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
    const kind = disputeKind(o, ticket);
    disputes.push({
      id: o.id,
      kind,
      order: orderRef(o.id),
      merchant: shop?.name ?? 'Commerce',
      customer: [who?.first_name, who?.last_name].filter(Boolean).join(' ') || 'Client',
      amountCents: o.total_cents ?? 0,
      openedAt: o.updated_at,
      fulfilment: o.fulfilment,
      message:
        lastFromCustomer?.body ??
        (o.stripe_dispute_id
          ? CHARGEBACK_MESSAGE
          : (ISSUE_MESSAGE[o.issue_kind] ?? DEFAULT_MESSAGE[kind] ?? DEFAULT_MESSAGE.manquant)),
      // Pour retrouver le paiement dans Stripe (compte du commerce, Direct charges).
      stripeAccount: shop?.stripe_account_id ?? null,
      paymentIntent: o.stripe_payment_intent_id ?? null,
      chargeback: Boolean(o.stripe_dispute_id),
      refundFailure: refundFailureText(o.refund_failure),
    });
    if (o.dispute_outcome && o.dispute_note) {
      rulings[o.id] = { outcome: o.dispute_outcome, note: o.dispute_note };
    }
  }
  return { disputes, rulings };
}
