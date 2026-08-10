import type { DailyCounts } from './progression';

/**
 * Les trophées — la mémoire longue de la chasse.
 *
 * Les missions se remettent à zéro chaque nuit et l'XP n'est qu'un nombre :
 * rien ne garde la trace de ce qui a été accompli une fois. Les trophées, si.
 * Ils sont DÉRIVÉS de l'état existant (XP, série, compteurs) — on ne stocke
 * rien de plus, donc rien ne peut se désynchroniser.
 */

export type Badge = {
  id: string;
  label: string;
  /** Ce qu'il faut faire pour l'obtenir — affiché tant qu'il est verrouillé. */
  hint: string;
  /** Nom d'icône Feather ; l'UI le résout. */
  icon: 'award' | 'zap' | 'target' | 'play-circle' | 'calendar' | 'star' | 'trending-up';
  earned: boolean;
};

export type BadgeInput = {
  xp: number;
  streak: number;
  counts: DailyCounts;
  /** Missions du jour accomplies. */
  missionsDone: number;
};

/**
 * Les trophées, dans l'ordre de difficulté croissante. Le premier tombe dès
 * la première ouverture : un tableau entièrement verrouillé ne donne envie de
 * rien.
 */
export function badgesOf({ xp, streak, counts, missionsDone }: BadgeInput): Badge[] {
  return [
    {
      id: 'premier-pas',
      label: 'Premier pas',
      hint: 'Ouvrez l’app',
      icon: 'star',
      earned: xp > 0 || counts.visit > 0,
    },
    {
      id: 'premiere-prise',
      label: 'Première prise',
      hint: 'Attrapez une vente flash',
      icon: 'target',
      earned: counts.catch > 0 || xp >= 40,
    },
    {
      id: 'joueur',
      label: 'Joueur',
      hint: 'Gagnez une partie',
      icon: 'play-circle',
      earned: counts.game > 0,
    },
    {
      id: 'sans-faute',
      label: 'Sans faute',
      hint: 'Bouclez les 3 missions du jour',
      icon: 'award',
      earned: missionsDone >= 3,
    },
    {
      id: 'serie-3',
      label: 'Habitué',
      hint: '3 jours d’affilée',
      icon: 'calendar',
      earned: streak >= 3,
    },
    {
      id: 'serie-7',
      label: 'Fidèle',
      hint: '7 jours d’affilée',
      icon: 'zap',
      earned: streak >= 7,
    },
    {
      id: 'mille-xp',
      label: 'Vétéran',
      hint: 'Atteignez 1 000 XP',
      icon: 'trending-up',
      earned: xp >= 1000,
    },
  ];
}

/** Combien de trophées sont débloqués. */
export function earnedCount(badges: Badge[]): number {
  return badges.filter((b) => b.earned).length;
}
