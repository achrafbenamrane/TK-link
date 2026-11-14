/**
 * LE CYCLE D'UNE COMMANDE GROSSISTE — schéma « Process grossiste / fournisseur » du client
 * (statuts : Commande reçue → En préparation → Expédiée → Livrée → Terminée) et CDC
 * V1.1, Grossiste : « aucune étape d'acceptation, même pour les commandes de volume ».
 *
 * La maquette dessine une étape « Acceptée » ; le CDC la retire (la commande payée vaut
 * acceptation, le ticket de préparation s'imprime tout de suite). Le CDC gagne : le
 * grossiste n'a pas de geste « Accepter ».
 */
export const WHOLESALE_STATUSES = [
  'recue',
  'preparation',
  'expediee',
  'livree',
  'terminee',
] as const;
export type WholesaleStatus = (typeof WHOLESALE_STATUSES)[number];

export const WHOLESALE_STATUS_LABEL: Record<WholesaleStatus, string> = {
  recue: 'Commande reçue',
  preparation: 'En préparation',
  expediee: 'Expédiée',
  livree: 'Livrée',
  terminee: 'Terminée',
};

/** Le geste qui fait avancer la commande, tel qu'il se lit sur le bouton. */
export const WHOLESALE_ACTION_LABEL: Record<WholesaleStatus, string | null> = {
  recue: 'Préparer la commande',
  preparation: 'Marquer expédiée',
  expediee: 'Marquer livrée',
  livree: 'Terminer',
  terminee: null,
};

export function nextWholesaleStatus(status: WholesaleStatus): WholesaleStatus | null {
  const i = WHOLESALE_STATUSES.indexOf(status);
  return WHOLESALE_STATUSES[i + 1] ?? null;
}

/**
 * LE BON DE PRÉPARATION — étape 11 du schéma : « bon de préparation, emballage, expédition ».
 * Trois gestes à cocher avant de pouvoir marquer la commande expédiée.
 */
export const PREP_STEPS = [
  { key: 'preleve', label: 'Articles prélevés' },
  { key: 'emballe', label: 'Colis emballé' },
  { key: 'etiquete', label: 'Étiquette de transport posée' },
] as const;
export type PrepStep = (typeof PREP_STEPS)[number]['key'];

/** À traiter = pas encore terminée. */
export function isOpenWholesale(status: WholesaleStatus): boolean {
  return status !== 'terminee';
}

/**
 * LES COMMANDES B2B DU SERVEUR (migration 0023) — mêmes statuts que les commandes des clients, lus
 * avec les mots du grossiste : pas d'acceptation (payée = « Commande reçue »), et « Expédiée » quand
 * le grossiste livre lui-même.
 */
export const B2B_STATUSES = [
  'paiement_attente',
  'payee',
  'acceptee',
  'preparation',
  'prete',
  'en_livraison',
  'recuperee',
  'livree',
  'refusee',
  'annulee',
  'remboursement_en_cours',
  'remboursee',
  'litige',
] as const;
export type B2bStatus = (typeof B2B_STATUSES)[number];

export const B2B_STATUS_LABEL: Record<B2bStatus, string> = {
  paiement_attente: 'À payer',
  payee: 'Commande reçue',
  acceptee: 'Commande reçue',
  preparation: 'En préparation',
  prete: 'Prête au retrait',
  en_livraison: 'Expédiée',
  recuperee: 'Retirée',
  livree: 'Livrée',
  refusee: 'Refusée',
  annulee: 'Annulée',
  remboursement_en_cours: 'Remboursement en cours',
  remboursee: 'Remboursée',
  litige: 'Litige en cours',
};

export type B2bStep =
  | { kind: 'advance'; to: 'preparation' | 'prete' | 'en_livraison' | 'livree'; label: string }
  /** Retrait chez le grossiste : il remet la commande contre le code de l'acheteur. */
  | { kind: 'handover'; label: string };

/** Le prochain geste du grossiste sur une vente du serveur, ou `null` s'il n'en a plus. */
export function nextB2bStep(order: {
  status: B2bStatus;
  fulfilment: 'touch-collect' | 'livraison';
}): B2bStep | null {
  const shipped = order.fulfilment === 'livraison';
  switch (order.status) {
    case 'payee':
    case 'acceptee':
      return { kind: 'advance', to: 'preparation', label: 'Préparer la commande' };
    case 'preparation':
      return shipped
        ? { kind: 'advance', to: 'en_livraison', label: 'Marquer expédiée' }
        : { kind: 'advance', to: 'prete', label: 'Prête au retrait' };
    case 'en_livraison':
      return shipped ? { kind: 'advance', to: 'livree', label: 'Marquer livrée' } : null;
    case 'prete':
      return shipped ? null : { kind: 'handover', label: 'Remettre la commande' };
    default:
      return null;
  }
}
