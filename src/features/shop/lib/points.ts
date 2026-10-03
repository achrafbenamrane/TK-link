import { getDeal } from '../model/catalog';
import { POINTS_PER_EURO } from '../model/loyalty';
import type { Order } from '../model/schema';

/**
 * Les points d'une commande, répartis par commerçant — CDC §8.2 et V1.1.
 *
 * « Les points restent liés au programme du commerce qui les a générés » :
 * 113 points O'Tokyo restent des points O'Tokyo. Une commande qui mêle deux
 * commerçants rapporte donc des points à chacun, sur ce qu'on lui a acheté.
 *
 * 1 € TTC dépensé en produits = 1 point ; la livraison n'entre pas dans le
 * calcul (les lignes d'articles seulement). Les offres publiées depuis l'app
 * n'ont pas encore de fiche commerçant : elles ne rapportent rien ici.
 *
 * Fonction pure : la ROUTE du panier la compose avec le programme de fidélité,
 * le shop n'important pas la feature `loyalty`.
 */
export function pointsByMerchant(order: Pick<Order, 'items'>): Record<string, number> {
  const euros: Record<string, number> = {};
  for (const line of order.items) {
    const deal = getDeal(line.dealId);
    if (!deal) continue;
    euros[deal.merchantId] = (euros[deal.merchantId] ?? 0) + line.price * line.qty;
  }
  const points: Record<string, number> = {};
  for (const [merchantId, eur] of Object.entries(euros)) {
    const pts = Math.round(eur * POINTS_PER_EURO);
    if (pts > 0) points[merchantId] = pts;
  }
  return points;
}
