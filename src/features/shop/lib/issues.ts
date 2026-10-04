import { canTransition, type Fulfilment, type OrderStatus } from './order-status';

/**
 * SIGNALER UN PROBLÈME — CDC V1.1, Utilisateur > Process (VALIDÉ) :
 * « un point d'entrée unique sur l'écran de commande, qui route automatiquement
 * vers un remboursement ou vers une file Super Admin selon l'incident ».
 *
 * Un seul bouton, trois motifs. Le client ne choisit pas la procédure : il dit
 * ce qui s'est passé, et c'est ce module qui décide où l'incident part.
 *
 * Pas de texte libre : il y aurait quelque chose à modérer (V1.1, même esprit
 * que la notation « sans texte libre »).
 */
export const ISSUE_KINDS = ['non_recue', 'non_conforme', 'autre'] as const;
export type IssueKind = (typeof ISSUE_KINDS)[number];

export const ISSUE_LABEL: Record<IssueKind, string> = {
  non_recue: 'Je n’ai pas reçu ma commande',
  non_conforme: 'Produit incomplet ou non conforme',
  autre: 'Autre problème',
};

export const ISSUE_HINT: Record<IssueKind, string> = {
  non_recue: 'La commande n’est pas arrivée ou n’a pas pu être retirée.',
  non_conforme: 'Il manque un article, ou il ne correspond pas à l’offre.',
  autre: 'Un souci avec le commerçant, le livreur ou le paiement.',
};

/** Où part l'incident. */
export type IssueRoute = 'remboursement' | 'admin';

export const ROUTE_LABEL: Record<IssueRoute, string> = {
  remboursement: 'Remboursement en cours',
  admin: 'Transmis au support TK LINK',
};

/**
 * Les statuts d'avant la remise : l'argent est pris, le client n'a encore rien
 * reçu. C'est le seul cas où le remboursement peut partir SANS examen — après
 * la remise, « je n'ai rien reçu » est une affirmation qu'un humain doit
 * vérifier, sinon n'importe quelle commande livrée se rembourse en un clic.
 */
const BEFORE_HANDOVER: OrderStatus[] = ['payee', 'acceptee', 'preparation'];

export type IssueDecision = {
  route: IssueRoute;
  /** Le nouveau statut de la commande, ou `null` si elle ne bouge pas. */
  status: OrderStatus | null;
};

export function routeIssue(
  kind: IssueKind,
  status: OrderStatus,
  fulfilment: Fulfilment,
): IssueDecision {
  if (
    kind === 'non_recue' &&
    BEFORE_HANDOVER.includes(status) &&
    canTransition(status, 'remboursement_en_cours', fulfilment)
  ) {
    return { route: 'remboursement', status: 'remboursement_en_cours' };
  }
  // Tout le reste file chez le Super Admin ; la commande passe en litige quand
  // la machine à états le permet, sinon elle garde son statut et le
  // signalement s'y attache.
  return {
    route: 'admin',
    status: canTransition(status, 'litige', fulfilment) ? 'litige' : null,
  };
}

/** Un problème se signale tant que la commande existe et n'est pas déjà close. */
export function canReportIssue(status: OrderStatus): boolean {
  return status !== 'panier' && status !== 'remboursee';
}
