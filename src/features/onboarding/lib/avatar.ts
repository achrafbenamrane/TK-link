import { CATEGORIES, CATEGORY_INFO } from '@/shared/lib/categories';

import type { Avatar, Interest } from '../model/schema';

/**
 * Options de l'avatar — pures, sans dépendance au rendu.
 *
 * Tout est dessiné : rien à télécharger, rien à empaqueter, et un avatar tient
 * en trois entiers dans le stockage.
 */

/** Fonds, dans l'esprit de la marque (verts, plus quelques teintes chaudes). */
export const AVATAR_HUES = [
  { bg: '#0F8A4C', fg: '#E6FBAE' },
  { bg: '#123A22', fg: '#C3F53C' },
  { bg: '#C3F53C', fg: '#123A22' },
  { bg: '#F2A93B', fg: '#3A2408' },
  { bg: '#3B7DD8', fg: '#E8F1FF' },
  { bg: '#D8563B', fg: '#FFE9E3' },
] as const;

export const FACE_LABELS = ['Sourire', 'Clin d’œil', 'Surpris', 'Serein'] as const;
export const ACCESSORY_LABELS = ['Aucun', 'Lunettes', 'Casquette', 'Feuille'] as const;

export const AVATAR_LIMITS = {
  hue: AVATAR_HUES.length,
  face: FACE_LABELS.length,
  accessory: ACCESSORY_LABELS.length,
} as const;

/** Fait tourner une option en boucle (les flèches ne bloquent jamais). */
export function cycle(value: number, delta: number, count: number): number {
  return (((value + delta) % count) + count) % count;
}

/** Avatar tiré au hasard — le bouton « surprenez-moi ». */
export function randomAvatar(rand: () => number = Math.random): Avatar {
  return {
    hue: Math.floor(rand() * AVATAR_LIMITS.hue),
    face: Math.floor(rand() * AVATAR_LIMITS.face),
    accessory: Math.floor(rand() * AVATAR_LIMITS.accessory),
  };
}

/** Couleurs effectives d'un avatar, bornées si la valeur déborde. */
export function avatarColors(avatar: Avatar): { bg: string; fg: string } {
  return AVATAR_HUES[avatar.hue % AVATAR_HUES.length]!;
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
 * L'onboarding est-il complet ? On n'exige que le strict nécessaire : un
 * prénom et au moins un centre d'intérêt. Bloquer sur davantage ferait fuir
 * avant même d'avoir vu l'app.
 */
export function canFinish(firstName: string, interests: Interest[]): boolean {
  return firstName.trim().length > 0 && interests.length > 0;
}
