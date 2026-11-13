import type { ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';

import { HeaderBackButton } from './header-back-button';
import { ThemeToggle } from './theme-toggle';
import { Wordmark } from './wordmark';

export type BrandBarProps = {
  /** Flèche retour à gauche. Absente : la place reste vide, le logo ne bouge pas. */
  onBack?: () => void;
  backLabel?: string;
  backTestID?: string;
  /** À droite : la bascule Nuit / Jour par défaut ; `null` pour ne rien y mettre. */
  right?: ReactNode;
};

/**
 * L'EN-TÊTE DES ÉCRANS D'ENTRÉE — choix du profil, connexion, inscription, mot de passe oublié.
 *
 * Retour · logo · Nuit/Jour, comme la maquette d'inscription du client. Le logo est centré sur
 * l'ÉCRAN, pas entre ses voisins : la bascule Nuit/Jour est bien plus large que la flèche, et un
 * logo calé entre les deux glissait à gauche, collé à la bascule. Il est donc posé en surimpression,
 * au centre exact, et les deux côtés gardent leur place même vides.
 */
export function BrandBar({
  onBack,
  backLabel = 'Retour',
  backTestID = 'brand-bar-back',
  right,
}: BrandBarProps) {
  // Sous 380 px de large (la plupart des Android), « Nuit | Jour » en toutes lettres touche le logo.
  const narrow = useWindowDimensions().width < 380;
  return (
    <View testID="brand-bar" className="h-14 flex-row items-center justify-between">
      <View className="pointer-events-none absolute inset-0 items-center justify-center">
        <Wordmark size={24} />
      </View>
      {onBack ? (
        <HeaderBackButton testID={backTestID} accessibilityLabel={backLabel} onPress={onBack} />
      ) : (
        <View className="h-10 w-10" />
      )}
      {right === undefined ? <ThemeToggle compact={narrow} /> : right}
    </View>
  );
}
