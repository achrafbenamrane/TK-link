import { DEMO_MISSIONS } from './demo';
import type { Mission } from '../model/store';

/**
 * Les missions encore proposables : les vraies, plus les missions d'exemple en démonstration,
 * moins celles que le livreur a refusées et celle qu'il a déjà acceptée.
 *
 * Une seule définition, parce que trois écrans (accueil, missions, carte) comptaient chacun à leur
 * façon : la mission acceptée restait « en attente » à l'accueil et se comptait deux fois.
 */
export function availableMissions({
  missions,
  showExamples,
  declined,
  activeOrderId,
}: {
  missions: Mission[];
  showExamples: boolean;
  declined: string[];
  activeOrderId?: string | undefined;
}): Mission[] {
  const all = showExamples ? [...missions, ...DEMO_MISSIONS] : missions;
  return all.filter((m) => !declined.includes(m.orderId) && m.orderId !== activeOrderId);
}
