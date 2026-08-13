import { CATEGORIES, CATEGORY_INFO } from '@/shared/lib/categories';

import { AVATARS } from '../model/avatars';
import type { Avatar, Interest } from '../model/schema';

/**
 * Règles de l'avatar — pures, sans dépendance au rendu. Les illustrations
 * elles-mêmes vivent dans `model/avatars.ts`.
 */

/** Combien d'illustrations la galerie propose. */
export const AVATAR_COUNT = AVATARS.length;

/**
 * Avatar tiré au hasard — le bouton « surprenez-moi ». Le hasard est
 * injectable pour que les tests décrivent un résultat au lieu d'en accepter
 * dix.
 */
export function randomAvatar(rand: () => number = Math.random): Avatar {
  return { preset: Math.min(AVATAR_COUNT - 1, Math.floor(rand() * AVATAR_COUNT)) };
}

/**
 * Les 8 catégories du CDC (§4, §23 Q2), dans l'ordre du document.
 *
 * Dérivées et non recopiées : une seconde liste finirait par diverger de celle
 * de l'accueil, et le tri par centres d'intérêt du §7 cesserait de fonctionner
 * sans que rien ne le signale.
 */
export const INTERESTS: { key: Interest; label: string; icon: string; emoji: string }[] =
  CATEGORIES.map((key) => ({
    key,
    label: CATEGORY_INFO[key].label,
    icon: CATEGORY_INFO[key].icon,
    emoji: CATEGORY_INFO[key].emoji,
  }));

/** Ajoute / retire un centre d'intérêt. Fonction pure. */
export function toggleInterest(list: Interest[], key: Interest): Interest[] {
  return list.includes(key) ? list.filter((i) => i !== key) : [...list, key];
}

/**
 * L'onboarding est-il complet ? On n'exige que le strict nécessaire : un nom
 * et au moins un centre d'intérêt. Bloquer sur davantage ferait fuir avant
 * même d'avoir vu l'app.
 */
export function canFinish(firstName: string, interests: Interest[]): boolean {
  return firstName.trim().length > 0 && interests.length > 0;
}
