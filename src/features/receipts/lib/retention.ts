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

/**
 * Durée de conservation, en années — CDC V1.0 §9.6.
 *
 * DIX ans, et non deux. Le V0.1 proposait deux ans ; le V1.0 écarte
 * explicitement cette règle : « la règle de suppression générale à 2 ans est
 * écartée. Les pièces justificatives comptables, notamment les factures
 * clients et fournisseurs, doivent être conservées 10 ans dans le cadre
 * professionnel français lorsque TKLINK en assure la conservation pour le
 * professionnel. »
 *
 * Ce n'est pas un réglage de confort : purger à deux ans effacerait des pièces
 * qu'un contrôle peut réclamer huit ans plus tard. Le client a vérifié la
 * source (Ministère de l'Économie) et l'a citée en référence R1 du document.
 */
export const RETENTION_YEARS = 10;

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
  return receipts.filter((r) => r.pinned || !isPurgeable(r, nowMs, years));
}

/**
 * Ce document peut-il être supprimé par la purge automatique ?
 *
 * Les dix ans du §9.6 visent « les pièces justificatives comptables » — pas
 * tous les documents. Le CDC §9.1 en distingue quatre, et deux échappent à
 * cette horloge :
 *
 *  • une GARANTIE se périme avec le produit, pas avec l'exercice comptable ;
 *    la supprimer d'office ferait disparaître une preuve d'achat que le client
 *    aurait encore pu faire valoir. Le CDC ne fixe pas sa durée : on ne la
 *    devine pas, on ne purge pas.
 *  • un ticket de PRÉPARATION n'est pas un document du client (§6.3) : il ne
 *    devrait jamais arriver ici. S'il y arrive, on le laisse à la purge
 *    ordinaire plutôt que de lui offrir dix ans d'archive.
 *
 * L'asymétrie est voulue : garder trop longtemps coûte du stockage, supprimer
 * trop tôt coûte une preuve.
 */
export function isPurgeable(
  receipt: Receipt,
  nowMs: number,
  years: number = RETENTION_YEARS,
): boolean {
  if (receipt.kind === 'garantie') return false;
  return isExpired(receipt, nowMs, years);
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
