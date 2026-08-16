import { PLATFORM_SETTINGS } from '@/shared/lib/platform-settings';

/**
 * LE MODÈLE ÉCONOMIQUE — CDC V1.0 §5.4, §6.2 et §10.2.
 *
 * Deux règles, et elles décident de tout le reste de l'espace commerçant :
 *
 *  • §9 — les cinq premières opérations sont gratuites, ensuite il faut un pack.
 *  • §21 — TK LINK prélève 5 % sur chaque vente.
 *
 * ⚠️ VALEURS PAR DÉFAUT, PAS DES CONSTANTES DE LOI. Le CDC §23 les marque « à
 * valider » par Farid : le quota, le prix des packs et le taux bougeront. Tout
 * passe donc par ces fonctions, jamais par un nombre écrit en dur dans un
 * écran — le jour de l'arbitrage, une seule ligne change ici.
 *
 * Tout est pur : ni date implicite, ni stockage. C'est ce qui rend ces règles
 * testables sans monter un seul écran.
 */

/**
 * Opérations offertes avant le premier pack — CDC V1.0 §6.2.
 *
 * Le cahier des charges en fait une EXIGENCE : « le nombre 5 doit être un
 * paramètre Super Admin, et non une constante inscrite dans le code ». La
 * valeur vient donc des réglages de plateforme ; ce module ne fait que la
 * relayer, pour que les écrans continuent d'avoir un seul point d'entrée.
 */
export const FREE_OPERATIONS = PLATFORM_SETTINGS.freeOperations;

/**
 * Commission TK LINK sur les transactions B2C, en pourcent — CDC §5.4.
 *
 * ⚠️ B2C UNIQUEMENT. Le §10.2 et la Remarque 1 interdisent explicitement de
 * reporter ce taux sur le B2B : « le taux de 5 % B2C ne doit pas être copié
 * automatiquement […] aucun taux B2B ne doit être codé en dur ». Le taux B2B
 * vaut `null` dans les réglages tant que Farid n'a pas tranché.
 */
export const COMMISSION_PCT = PLATFORM_SETTINGS.commissionB2cPct;

export type Pack = {
  id: string;
  label: string;
  /** Opérations créditées par le pack. */
  operations: number;
  /** Prix du pack, en centimes — jamais en euros flottants. */
  priceCents: number;
};

/**
 * Les packs, du plus petit au plus grand. Le prix à l'opération baisse avec le
 * volume : un pack qui ne récompenserait pas l'engagement n'a aucune raison
 * d'exister à côté du plus petit.
 */
export const PACKS: Pack[] = [
  { id: 'pack_10', label: 'Pack Découverte', operations: 10, priceCents: 990 },
  { id: 'pack_30', label: 'Pack Quartier', operations: 30, priceCents: 2490 },
  { id: 'pack_100', label: 'Pack Enseigne', operations: 100, priceCents: 6900 },
];

/** Prix moyen d'une opération dans un pack, en centimes — sert à comparer. */
export function unitPriceCents(pack: Pack): number {
  return Math.round(pack.priceCents / pack.operations);
}

/**
 * Combien d'opérations gratuites il reste. Ne descend jamais sous zéro : un
 * compteur négatif s'afficherait tel quel sur trois écrans différents.
 */
export function freeLeft(used: number): number {
  return Math.max(0, FREE_OPERATIONS - used);
}

/** Opérations encore publiables : le reliquat gratuit plus les packs achetés. */
export function operationsLeft(used: number, purchased: number): number {
  return Math.max(0, FREE_OPERATIONS + purchased - used);
}

/** Peut-on publier une offre de plus ? */
export function canPublish(used: number, purchased: number): boolean {
  return operationsLeft(used, purchased) > 0;
}

/**
 * La commission sur une vente, en centimes, arrondie à l'entier le plus proche.
 *
 * L'arrondi se fait ICI et une seule fois : calculer la part du commerçant par
 * soustraction garantit que les deux montants retombent toujours sur le total,
 * ce qu'un second arrondi indépendant ne garantirait pas.
 */
export function commissionCents(totalCents: number, pct: number = COMMISSION_PCT): number {
  if (totalCents <= 0) return 0;
  return Math.round((totalCents * pct) / 100);
}

/** Ce que le commerçant touche réellement, commission déduite. */
export function netCents(totalCents: number, pct: number = COMMISSION_PCT): number {
  if (totalCents <= 0) return 0;
  return totalCents - commissionCents(totalCents, pct);
}

/** « 12,90 € » — un montant en centimes, à la française. */
export function formatCents(cents: number): string {
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`;
}

/**
 * Une saisie en euros vers des centimes. `null` si ce n'est pas un montant.
 *
 * La virgule est acceptée autant que le point : sur un clavier français, c'est
 * la virgule qui tombe sous le pouce, et refuser « 24,90 » serait refuser la
 * saisie naturelle. Tout passe par des ENTIERS de centimes ensuite — un prix en
 * flottant finit toujours par afficher 24,900000000000002.
 */
export function parseEurosToCents(input: string): number | null {
  const clean = input.trim().replace(',', '.');
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return null;
  const value = Number(clean);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}
