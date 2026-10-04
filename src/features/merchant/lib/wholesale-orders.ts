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
