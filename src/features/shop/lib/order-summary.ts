import { getDeal, LOCAL_MERCHANT_ID } from '../model/catalog';
import type { Order } from '../model/schema';
import { FULFILMENT_LABEL, ORDER_STATUS_LABEL, type OrderStatus } from './order-status';

/**
 * Une commande vue du comptoir : ce qu'il faut pour la lire d'un coup d'œil.
 *
 * La route du commerçant la passe à son tableau de bord : `merchant` ne connaît
 * pas `shop`, qui ne connaît pas `merchant` — ce résumé est le seul langage
 * qu'ils ont en commun.
 */
export type OrderSummary = {
  id: string;
  /** « #TKL-1A2B3C » — la référence qu'on lit à voix haute au comptoir. */
  ref: string;
  /** « Sushi Mix » ou « Sushi Mix +2 » quand la commande a plusieurs lignes. */
  title: string;
  modeLabel: string;
  statusLabel: string;
  tone: 'todo' | 'progress' | 'done';
  totalCents: number;
};

/**
 * Ce que le commerçant a à faire de cette commande.
 *
 * « À préparer » : payée, rien n'a commencé (le paiement vaut acceptation, V1.1).
 * « En cours » : en préparation, ou partie. « Terminé » : prête, remise, livrée.
 * Les états d'exception se rangent avec ce qui est réglé : il n'y a plus rien à
 * préparer.
 */
export function toneOf(status: OrderStatus): OrderSummary['tone'] {
  switch (status) {
    case 'creee':
    case 'paiement_attente':
    case 'payee':
    case 'acceptee':
      return 'todo';
    case 'preparation':
    case 'en_livraison':
      return 'progress';
    default:
      return 'done';
  }
}

export function summarizeOrder(order: Order): OrderSummary {
  const [first, ...rest] = order.items;
  const base = first?.title ?? 'Commande';
  return {
    id: order.id,
    ref: `#TKL-${order.id.slice(-6).toUpperCase()}`,
    title: rest.length > 0 ? `${base} +${rest.length}` : base,
    modeLabel: FULFILMENT_LABEL[order.fulfilment],
    statusLabel: ORDER_STATUS_LABEL[order.status],
    tone: toneOf(order.status),
    totalCents: Math.round(order.total * 100),
  };
}

/** Une commande est « honorée » quand le client l'a récupérée ou reçue. */
export function isHonoured(order: Order): boolean {
  return order.status === 'recuperee' || order.status === 'livree';
}

/**
 * Une commande est celle de CE commerce quand l'une de ses lignes est une de ses
 * offres : une vente publiée depuis l'app (`pub_…`, convention posée par
 * l'accueil quand il convertit une publication), ou une offre du catalogue de
 * démonstration rattachée à la boutique locale.
 *
 * Fonction pure : la route passe les identifiants publiés, `shop` ne connaît
 * pas `merchant`.
 */
export function isMerchantOrder(order: Order, publishedDealIds: ReadonlySet<string>): boolean {
  return order.items.some(
    (line) =>
      publishedDealIds.has(line.dealId) || getDeal(line.dealId)?.merchantId === LOCAL_MERCHANT_ID,
  );
}
