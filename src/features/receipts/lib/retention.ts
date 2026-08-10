import type { Receipt } from '../model/schema';

/**
 * CONSERVATION ET SUPPRESSION DES DOCUMENTS — CDC §16.
 *
 * Deux exigences opposées, et c'est tout le sujet :
 *
 *  • garder assez longtemps pour que le document serve (garantie, note de
 *    frais, contrôle comptable) ;
 *  • ne PAS garder au-delà, parce qu'un historique d'achats est une donnée
 *    personnelle, et que le RGPD impose de ne conserver que le temps
 *    nécessaire. Un portefeuille qui accumule à vie est une fuite en attente.
 *
 * ⚠️ VALEUR PAR DÉFAUT. Le CDC §23 Q8 laisse la durée « à valider » et propose
 * DEUX ANS ; c'est donc ce qu'on applique, en un seul endroit. Le jour où
 * Farid tranche (ou où le comptable impose dix ans pour les factures pro),
 * une ligne change ici et rien d'autre dans l'app.
 *
 * Tout est pur : l'instant est TOUJOURS passé en paramètre, sinon la purge
 * devient intestable et se met à dépendre de l'heure qu'il est.
 */

/** Durée de conservation proposée par le CDC §23 Q8, en années. */
export const RETENTION_YEARS = 2;

/**
 * Jusqu'à quand ce document est conservé.
 *
 * Le calcul passe par `Date` et non par « 730 × 86 400 000 » : deux ans
 * calendaires tombent au même jour du mois, années bissextiles comprises. Un
 * décalage d'un jour sur une purge automatique, c'est un document effacé la
 * veille du contrôle.
 */
export function keptUntil(receipt: Receipt, years: number = RETENTION_YEARS): number {
  const d = new Date(receipt.issuedAt);
  d.setFullYear(d.getFullYear() + years);
  return d.getTime();
}

/** Ce document a-t-il dépassé sa durée de conservation ? */
export function isExpired(
  receipt: Receipt,
  nowMs: number,
  years: number = RETENTION_YEARS,
): boolean {
  return keptUntil(receipt, years) <= nowMs;
}

/** Jours restants avant suppression automatique ; 0 une fois la date passée. */
export function daysLeft(receipt: Receipt, nowMs: number, years: number = RETENTION_YEARS): number {
  const ms = keptUntil(receipt, years) - nowMs;
  return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000);
}

/**
 * Ce qui reste après la purge.
 *
 * Un document ÉPINGLÉ survit : l'utilisateur a explicitement dit qu'il en
 * avait besoin (garantie de dix ans, litige en cours), et une purge qui
 * ignorerait ce geste détruirait précisément ce qu'on lui avait promis de
 * garder. C'est lui qui décide de le dépingler.
 */
export function purge(
  receipts: Receipt[],
  nowMs: number,
  years: number = RETENTION_YEARS,
): Receipt[] {
  return receipts.filter((r) => r.pinned || !isExpired(r, nowMs, years));
}

/** Combien de documents la prochaine purge emporterait. */
export function expiringCount(
  receipts: Receipt[],
  nowMs: number,
  years: number = RETENTION_YEARS,
): number {
  return receipts.length - purge(receipts, nowMs, years).length;
}

/** « 12/08/2028 » — la date jusqu'à laquelle le document est gardé. */
export function formatKeptUntil(receipt: Receipt, years: number = RETENTION_YEARS): string {
  const d = new Date(keptUntil(receipt, years));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
