import type { PublishedOffer } from '../model/schema';

/**
 * La vie d'une offre publiée — pure, l'instant toujours passé en paramètre.
 *
 * Une offre flash meurt de deux façons : le temps ou le stock. Les deux
 * comptent, et l'écran du commerçant doit dire LAQUELLE l'a emportée — « ça
 * n'est plus en ligne » sans raison ne lui apprend rien sur ce qu'il doit
 * refaire demain.
 */

export type OfferState = 'en-ligne' | 'epuisee' | 'terminee' | 'retiree';

/** Fin prévue de l'offre, en millisecondes. */
export function endsAt(offer: PublishedOffer): number {
  return offer.publishedAt + offer.durationMinutes * 60_000;
}

/** Secondes restantes, jamais négatives. */
export function secondsLeft(offer: PublishedOffer, nowMs: number): number {
  return Math.max(0, Math.round((endsAt(offer) - nowMs) / 1000));
}

/**
 * L'état d'une offre. L'ordre des tests est délibéré : un retrait manuel prime
 * sur tout (c'est une décision), puis le stock, puis le temps.
 */
export function stateOf(offer: PublishedOffer, nowMs: number): OfferState {
  if (offer.offline) return 'retiree';
  if (offer.stockLeft <= 0) return 'epuisee';
  return secondsLeft(offer, nowMs) > 0 ? 'en-ligne' : 'terminee';
}

export const STATE_LABEL: Record<OfferState, string> = {
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
