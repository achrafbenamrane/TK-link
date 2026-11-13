import { openAuthSessionAsync } from 'expo-web-browser';

import {
  cancelOrder,
  type OrdersError,
  quoteDelivery,
  reserveOrder,
  type ReserveInput,
  startPayment,
} from './orders-api';

/** Une offre du serveur porte l’identifiant de sa ligne `flash_offers` (un UUID). */
export const SERVER_DEAL_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ServerCheckout =
  { ok: true; orderId: string; paymentUrl: string } | { ok: false; code: OrdersError };

/**
 * Le passage en caisse d’une commande du serveur : réserver le stock, chiffrer la livraison (Uber
 * Direct), ouvrir la page de paiement (Stripe Checkout). Si une étape échoue APRÈS la réservation,
 * la réservation est annulée : le stock revient aussitôt aux autres clients, au lieu d’attendre
 * l’expiration de 15 minutes.
 */
export async function prepareServerCheckout(input: ReserveInput): Promise<ServerCheckout> {
  const reserved = await reserveOrder(input);
  if (!reserved.ok) return reserved;
  const orderId = reserved.value;

  if (input.fulfilment === 'livraison') {
    const quote = await quoteDelivery(orderId);
    if (!quote.ok) {
      await cancelOrder(orderId);
      return quote;
    }
  }

  const payment = await startPayment(orderId);
  if (!payment.ok) {
    await cancelOrder(orderId);
    return payment;
  }
  return { ok: true, orderId, paymentUrl: payment.value };
}

/**
 * Ouvre la page de paiement dans un navigateur sécurisé, qui se referme quand Stripe renvoie vers
 * l’app (`tklink://commande/<id>`, via la page `/stripe/paiement` du site). Le résultat ne prouve
 * rien : seul le webhook Stripe marque la commande payée, et l’app relit la commande.
 */
export async function openPaymentPage(url: string): Promise<void> {
  await openAuthSessionAsync(url, 'tklink://commande').catch(() => undefined);
}

/** Ce que l’écran dit quand le passage en caisse échoue. */
export const CHECKOUT_ERROR: Record<OrdersError, string> = {
  not_configured: 'Le paiement en ligne n’est pas disponible en démonstration.',
  not_signed_in: 'Reconnectez-vous pour commander.',
  out_of_stock: 'Plus assez de pièces : un autre client a été plus rapide. Ajustez la quantité.',
  offer_unavailable: 'Cette offre vient de se terminer.',
  mode_unavailable: 'Ce mode de remise n’est pas proposé pour cette offre.',
  one_shop_per_order: 'Une commande par commerce : passez-les l’une après l’autre.',
  too_many_pending: 'Vous avez déjà trois commandes à payer. Payez-les ou annulez-les d’abord.',
  address_required: 'Ajoutez une adresse de livraison.',
  delivery_unavailable: 'La livraison n’est pas possible à cette adresse. Essayez le retrait.',
  phone_required: 'Ajoutez votre numéro (Profil → Mon compte) : le coursier en a besoin.',
  shop_cannot_be_paid: 'Ce commerce n’accepte pas encore le paiement en ligne.',
  service_unavailable: 'Le paiement en ligne n’est pas encore activé. Réessayez bientôt.',
  reservation_expired: 'La réservation a expiré. Repassez commande.',
  not_your_order: 'Commande introuvable.',
  invalid_transition: 'Action impossible pour cette commande.',
  pickup_refused: 'Code de retrait incorrect.',
  network: 'Pas de connexion. Rien n’a été débité : réessayez.',
  unknown: 'La commande n’a pas pu aboutir. Rien n’a été débité : réessayez.',
};
