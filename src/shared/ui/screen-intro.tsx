import type { ReactNode } from 'react';
import { View } from 'react-native';

import { cn } from '@/shared/lib/cn';

import { AppText } from './text';

export type ScreenIntroProps = {
  title: string;
  /** Une phrase — ou des fragments (une adresse en gras…). */
  subtitle?: ReactNode;
  /** Sous le texte : l'avatar de l'inscription, l'icône de la boutique… */
  children?: ReactNode;
  testID?: string;
  /** Pour régler la marge du bas quand le parent espace déjà ses enfants (`gap`). */
  className?: string;
};

/**
 * LE TITRE DES ÉCRANS D'ENTRÉE — un titre et une phrase, centrés, toujours à la même taille et à la
 * même distance de ce qui suit. Chaque écran (profil, connexion, inscription) posait le sien à sa
 * façon : logo géant à gauche ici, titre de 21 px là, sous-titre de 12 px ailleurs. Ici, une seule
 * mise en page, et la phrase garde une largeur de lecture : elle ne laisse plus un mot seul sur sa
 * deuxième ligne.
 */
export function ScreenIntro({ title, subtitle, children, testID, className }: ScreenIntroProps) {
  return (
    <View testID={testID} className={cn('mb-8 items-center', className)}>
      <AppText variant="display" className="text-center text-2xl">
        {title}
      </AppText>
      {subtitle ? (
        <AppText variant="caption" className="mt-2 max-w-xs text-center leading-5">
          {subtitle}
        </AppText>
      ) : null}
      {children ? <View className="mt-6 items-center">{children}</View> : null}
    </View>
  );
}
