import type { PublishedOffer } from '../model/schema';

/**
 * La vie d'une offre publiée — pure, l'instant toujours passé en paramètre.
 *
 * Une offre flash meurt de deux façons : le temps ou le stock. Les deux
 * comptent, et l'écran du commerçant doit dire LAQUELLE l'a emportée — « ça
 * n'est plus en ligne » sans raison ne lui apprend rien sur ce qu'il doit
 * refaire demain.
 */

/**
 * Les six états du CDC §4.1 : brouillon, planifiée, active, épuisée, expirée,
 * annulée. Deux ont été ajoutés aux quatre d'origine — « brouillon » et
 * « planifiée » — parce que le cahier des charges décrit un cycle qui commence
 * AVANT la mise en ligne.
 *
 * Un seul d'entre eux est stocké avec « retirée » : les autres se DÉDUISENT de
 * l'heure et du stock. Ce n'est pas un raccourci. Un statut stocké doit être
 * tenu à jour par quelqu'un ; sans back-end pour le faire, une offre resterait
 * « active » des heures après son terme et le commerçant attendrait des ventes
 * impossibles. Un statut dérivé ne peut pas mentir — il se recalcule à chaque
 * lecture.
 */
export type OfferState =
  'brouillon' | 'planifiee' | 'en-ligne' | 'epuisee' | 'terminee' | 'retiree';

/**
 * Quand l'offre COMMENCE — CDC §4.2, étape « publier ou programmer ».
 *
 * `startsAt` à zéro veut dire « à la publication ». C'est aussi ce que valent
 * les offres enregistrées avant que la programmation n'existe : elles gardent
 * donc exactement le comportement qu'elles avaient.
 */
export function startOf(offer: PublishedOffer): number {
  return offer.startsAt > 0 ? offer.startsAt : offer.publishedAt;
}

/**
 * Fin prévue de l'offre, en millisecondes.
 *
 * La durée court depuis le DÉBUT et non depuis la création : une offre
 * programmée pour demain 18 h dure une heure à partir de 18 h, pas une heure à
 * partir du moment où on l'a saisie.
 */
export function endsAt(offer: PublishedOffer): number {
  return startOf(offer) + offer.durationMinutes * 60_000;
}

/**
 * Secondes restantes, jamais négatives.
 *
 * Avant l'ouverture, c'est le temps qui reste AVANT le début : un commerçant
 * qui programme une offre veut savoir quand elle part, pas quand elle finit.
 */
export function secondsLeft(offer: PublishedOffer, nowMs: number): number {
  const cible = nowMs < startOf(offer) ? startOf(offer) : endsAt(offer);
  return Math.max(0, Math.round((cible - nowMs) / 1000));
}

/**
 * L'état d'une offre. L'ordre des tests est délibéré.
 *
 * Le brouillon passe en premier : il n'a jamais été publié, aucun horaire ne le
 * concerne. Le retrait vient ensuite, parce que c'est une DÉCISION — une offre
 * retirée ne doit jamais se rallumer parce que son horaire le voudrait. Puis la
 * programmation, puis le stock, puis le temps : entre « épuisée » et
 * « terminée », c'est la raison de l'arrêt qui compte pour le commerçant — un
 * stock parti est un succès, un temps écoulé est un invendu.
 */
export function stateOf(offer: PublishedOffer, nowMs: number): OfferState {
  if (offer.state === 'brouillon') return 'brouillon';
  if (offer.offline) return 'retiree';
  if (nowMs < startOf(offer)) return 'planifiee';
  if (offer.stockLeft <= 0) return 'epuisee';
  return nowMs < endsAt(offer) ? 'en-ligne' : 'terminee';
}

export const STATE_LABEL: Record<OfferState, string> = {
  brouillon: 'Brouillon',
  planifiee: 'Programmée',
  'en-ligne': 'En ligne',
  epuisee: 'Épuisée',
  terminee: 'Terminée',
  retiree: 'Retirée',
};

/** Une offre visible par les clients en ce moment. */
export function isLive(offer: PublishedOffer, nowMs: number): boolean {
  return stateOf(offer, nowMs) === 'en-ligne';
}

/** Les offres en ligne, les plus récentes d'abord. */
export function liveOffers(offers: PublishedOffer[], nowMs: number): PublishedOffer[] {
  return offers.filter((o) => isLive(o, nowMs)).sort((a, b) => b.publishedAt - a.publishedAt);
}

/** Remise affichée, en pourcentage entier ; `null` si le prix barré ne tient pas. */
export function discountPct(offer: PublishedOffer): number | null {
  if (offer.oldPriceCents <= offer.priceCents) return null;
  return Math.round((1 - offer.priceCents / offer.oldPriceCents) * 100);
}

/** Chiffre d'affaires potentiel d'une offre si tout le stock part, en centimes. */
export function potentialCents(offer: PublishedOffer): number {
  return offer.priceCents * offer.stock;
}

/** Ce qui a réellement été vendu, en centimes. */
export function soldCents(offer: PublishedOffer): number {
  return offer.priceCents * (offer.stock - offer.stockLeft);
}
