import type { ComponentProps } from 'react';
import type { Feather } from '@expo/vector-icons';

import { PLATFORM_SETTINGS } from '@/shared/lib/platform-settings';

/**
 * LES DIAPOSITIVES « TK LINK » — l'espace de communication en haut de l'accueil.
 *
 * Demande du client : cet espace sert d'abord à présenter TK LINK et à expliquer l'app aux clients ;
 * il pourra être monétisé plus tard (publicité), mais pas pour l'instant. Il remplace la vente
 * flash mise en avant (la côte de bœuf).
 *
 * Que des faits du cahier des charges : un message qui promet ce que l'app ne fait pas serait pire
 * qu'une diapositive vide. Les textes vivent ici, pas dans l'écran : on les remplace sans toucher au
 * composant, et le client peut les réécrire.
 */
export type SlideIcon = ComponentProps<typeof Feather>['name'];

export type Slide = {
  id: 'touch-collect' | 'parrainage' | 'flash';
  icon: SlideIcon;
  title: string;
  text: string;
  /** Où mène un appui sur la diapositive, s'il mène quelque part. */
  href?: '/parrainage';
};

const reward = PLATFORM_SETTINGS.referralRewardEur;

export const SLIDES: Slide[] = [
  {
    id: 'flash',
    icon: 'zap',
    title: 'Des offres flash, près de chez vous',
    text: 'Un prix barré, un stock limité, un compte à rebours : quand c’est fini, c’est fini.',
  },
  {
    id: 'touch-collect',
    icon: 'shopping-bag',
    title: 'Touch & Collect : gratuit',
    text: 'Commandez en ligne, retirez chez le commerçant. Aucun frais, aucune surprise.',
  },
  {
    id: 'parrainage',
    icon: 'gift',
    title: `Parrainez, gagnez ${reward} €`,
    text: `${reward} € crédités à vous et à votre filleul dès son premier achat.`,
    href: '/parrainage',
  },
];
