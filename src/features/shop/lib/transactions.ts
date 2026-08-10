import type { Category } from '@/shared/lib/categories';

import { getDeal, getMerchant } from '../model/catalog';
import type { Order } from '../model/schema';
/**
 * DE LA COMMANDE AU TICKET — le premier maillon du CDC §14.
 *
 * « Transaction → Ticket → Facture ». Les trois écrans existaient, mais rien
 * ne les reliait : une commande remise au client ne produisait aucun ticket,
 * et la promesse de la marque — le ticket papier disparaît — n'était vraie
 * qu'en théorie.
 *
 * Cette fonction est PURE et ne connaît pas la feature `receipts` : elle
 * produit une forme neutre, que la route passe au portefeuille de tickets. La
 * boutique n'importe rien, le portefeuille n'importe rien ; ils se rencontrent
 * dans `src/app`.
 */

/** Ce qu'un ticket attend pour naître. Volontairement sans dépendance. */
export type Transaction = {
  orderId: string;
  merchant: string;
  category: 'restauration' | 'alimentation' | 'autre';
  channel: 'online';
  issuedAt: number;
  lines: { label: string; qty: number; unitCents: number }[];
};

/**
 * Les huit catégories d'offres (CDC §4) vers les familles de dépense du ticket.
 *
 * Les deux listes ne se recouvrent pas : le ticket classe pour la COMPTABILITÉ
 * (alimentation, carburant, santé…), l'offre classe pour la RECHERCHE (mode,
 * high-tech, sport…). Traduire l'un dans l'autre au petit bonheur produirait
 * un plan comptable faux ; on ne prétend donc qu'aux correspondances sûres, le
 * reste tombe dans « autre » — un classement honnête que le comptable corrige,
 * plutôt qu'une devinette qu'il ne verra pas.
 */
const CATEGORY_OF: Partial<Record<Category, Transaction['category']>> = {
  restauration: 'restauration',
};

/**
 * Une commande terminée donne-t-elle lieu à un ticket ?
 *
 * Seules les commandes RÉELLEMENT honorées : une annulation ou un
 * remboursement n'a pas à peupler le portefeuille du client, et surtout pas la
 * comptabilité de son commerçant.
 */
export function producesReceipt(order: Order): boolean {
  return order.status === 'recuperee' || order.status === 'livree';
}

/**
 * Convertit une commande honorée en transaction.
 *
 * Les frais de livraison deviennent une LIGNE et non un supplément invisible :
 * un ticket dont le total ne correspond pas à la somme de ses lignes est un
 * ticket que le comptable refuse.
 */
export function orderToTransaction(order: Order): Transaction {
  const firstDeal = order.items[0] ? getDeal(order.items[0].dealId) : undefined;
  const merchant = firstDeal ? getMerchant(firstDeal.merchantId)?.name : undefined;

  const lines = order.items.map((line) => ({
    label: line.title,
    qty: line.qty,
    unitCents: Math.round(line.price * 100),
  }));

  if (order.deliveryFee > 0) {
    lines.push({ label: 'Livraison', qty: 1, unitCents: Math.round(order.deliveryFee * 100) });
  }

  // La remise s'inscrit en NÉGATIF plutôt que d'être retirée des prix : le
  // client doit retrouver le prix qu'il a vu, et la remise qu'il a obtenue.
  if (order.discount > 0) {
    lines.push({
      label: order.couponCode ? `Remise ${order.couponCode}` : 'Remise',
      qty: 1,
      unitCents: -Math.round(order.discount * 100),
    });
  }

  return {
    orderId: order.id,
    // Une offre publiée depuis l'app n'a pas de fiche commerçant tant que le
    // back-office n'existe pas : on le dit plutôt que d'inventer une enseigne.
    merchant: merchant ?? 'Commerçant TK LINK',
    category: (firstDeal && CATEGORY_OF[firstDeal.category]) ?? 'autre',
    channel: 'online',
    issuedAt: Date.now(),
    lines,
  };
}
