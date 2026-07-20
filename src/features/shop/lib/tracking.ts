import type { Coord, Order } from '../model/schema';
import { distanceKm } from './geo';

/**
 * Suivi de livraison — géométrie pure, testable sans carte ni réseau.
 *
 * DÉMO : la position du livreur est INTERPOLÉE le long du trajet en fonction du
 * temps écoulé depuis la commande. Il n'y a pas de livreur réel à suivre tant
 * que le back-end n'existe pas. Le jour où il enverra des positions GPS, seule
 * `courierPosition` disparaît — la carte, elle, ne change pas.
 */

/** Fenêtres de la simulation, alignées sur demoStatusFor(). */
export const SHIPPING_AFTER_S = 60;
export const DELIVERED_AFTER_S = 240;

/** Avancement de la course, de 0 (départ) à 1 (arrivé). */
export function deliveryProgress(order: Order, now: number = Date.now()): number {
  const elapsed = (now - order.createdAt) / 1000;
  if (elapsed <= SHIPPING_AFTER_S) return 0;
  if (elapsed >= DELIVERED_AFTER_S) return 1;
  return (elapsed - SHIPPING_AFTER_S) / (DELIVERED_AFTER_S - SHIPPING_AFTER_S);
}

/** Minutes restantes avant l'arrivée, arrondies à la minute pleine. */
export function minutesRemaining(order: Order, now: number = Date.now()): number {
  const elapsed = (now - order.createdAt) / 1000;
  return Math.max(0, Math.ceil((DELIVERED_AFTER_S - elapsed) / 60));
}

/**
 * Point situé à la fraction `t` d'une polyligne, mesuré en DISTANCE parcourue
 * et non en nombre de points.
 *
 * La nuance compte : un trajet routier a des points très serrés dans les
 * virages et très espacés en ligne droite. Interpoler sur l'index ferait
 * ramper le livreur dans les virages puis sauter sur les lignes droites.
 */
export function pointAlong(line: Coord[], t: number): Coord | null {
  if (line.length === 0) return null;
  const first = line[0];
  const last = line[line.length - 1];
  if (!first || !last) return null;
  if (line.length === 1 || t <= 0) return first;
  if (t >= 1) return last;

  const spans: number[] = [];
  let total = 0;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const b = line[i];
    if (!a || !b) continue;
    const d = distanceKm(a, b);
    spans.push(d);
    total += d;
  }
  if (total === 0) return first;

  let travelled = t * total;
  for (let i = 0; i < spans.length; i++) {
    const span = spans[i] ?? 0;
    if (travelled <= span || i === spans.length - 1) {
      const a = line[i];
      const b = line[i + 1];
      if (!a || !b) return last;
      const ratio = span === 0 ? 0 : Math.min(1, travelled / span);
      return {
        lat: a.lat + (b.lat - a.lat) * ratio,
        lng: a.lng + (b.lng - a.lng) * ratio,
      };
    }
    travelled -= span;
  }
  return last;
}

/** Position simulée du livreur sur le trajet, à cet instant. */
export function courierPosition(
  order: Order,
  route: Coord[],
  now: number = Date.now(),
): Coord | null {
  return pointAlong(route, deliveryProgress(order, now));
}
