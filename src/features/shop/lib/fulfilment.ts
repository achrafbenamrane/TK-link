import { FULFILMENTS, FULFILMENT_LABEL, type Fulfilment } from './order-status';
import type { Deal } from '../model/schema';

/**
 * Comment une offre se récupère — CDC V1.0 §3.1.
 *
 * Le cahier des charges liste neuf informations qu'une carte Flash doit
 * afficher AU MINIMUM : image, commerçant, produit, distance, prix initial,
 * prix Flash, quantité restante, compte à rebours **et le mode Touch & Collect
 * / livraison**. Ce dernier manquait.
 *
 * Ce n'est pas un détail de présentation : quelqu'un qui repère une offre à
 * 8 km ne la traite pas pareil selon qu'il devra aller la chercher ou qu'on
 * la lui apporte. L'information arrive aujourd'hui trop tard, au panier.
 */

/** Les modes acceptés par une offre. Absent = les deux. */
export function fulfilmentsOf(deal: Deal): Fulfilment[] {
  const list = deal.fulfilments?.length ? deal.fulfilments : [...FULFILMENTS];
  // On garde l'ordre canonique : « Touch & Collect ou livraison » se lit
  // toujours dans le même sens, quel que soit l'ordre de saisie.
  return FULFILMENTS.filter((f) => list.includes(f));
}

/**
 * Le libellé court porté par la carte.
 *
 * « Touch & Collect ou livraison » quand les deux sont possibles : la carte
 * n'a pas la place de deux pastilles, et l'alternative se lit d'un coup.
 */
export function fulfilmentLabel(deal: Deal): string {
  const list = fulfilmentsOf(deal);
  if (list.length === FULFILMENTS.length) return 'Touch & Collect ou livraison';
  return FULFILMENT_LABEL[list[0]!];
}

/** L'icône Feather qui va avec — un sac pour le retrait, un camion sinon. */
export function fulfilmentIcon(deal: Deal): 'shopping-bag' | 'truck' {
  const list = fulfilmentsOf(deal);
  return list.length === 1 && list[0] === 'livraison' ? 'truck' : 'shopping-bag';
}
