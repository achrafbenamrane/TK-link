import { Feather } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { fmtCountdown } from './use-countdown';

/** Pastille de compte à rebours — rouge quand il reste peu de temps. */
export function TimerPill({ remaining, low }: { remaining: number; low?: boolean }) {
  return (
    <View
      className="mb-3 self-center rounded-pill px-4 py-1.5"
      style={{ backgroundColor: low ? colors.danger : 'rgba(246,242,234,0.16)' }}
    >
      <AppText className="font-display text-ink-inverse" style={{ fontSize: 15, letterSpacing: 1 }}>
        {`⏱ ${fmtCountdown(remaining)}`}
      </AppText>
    </View>
  );
}

/**
 * Coquille « affiche » des jeux — le look des posts que les marques food
 * publient (fond rouge de marque, gros titre, la photo du produit en pièce de
 * jeu). Tous les jeux s'y logent pour un rendu homogène.
 *
 * L'accent doré reprend le blanc + jaune des références ; il ne vit que sur les
 * titres de jeux, pas dans le reste de l'app.
 */
const GOLD = '#FFC24B';

type Props = {
  /** Titre principal, en capitales (ex. « TROUVEZ LES PAIRES »). */
  title: string;
  /** Mot mis en avant en doré (ex. « GAGNEZ »). */
  accent?: string;
  subtitle?: string;
  onBack: () => void;
  children: ReactNode;
  /** Barre d'action collée en bas (bouton, etc.). */
  footer?: ReactNode;
  /** Corps défilant (défaut) ou centré fixe. */
  scroll?: boolean;
};

export function GameShell({
  title,
  accent,
  subtitle,
  onBack,
  children,
  footer,
  scroll = true,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-brand-500" style={{ paddingTop: insets.top }}>
      {/* Bandeau : retour + signature */}
      <View className="flex-row items-center justify-between px-5 pb-1 pt-2">
        <Pressable
          testID="game-back"
          accessibilityRole="button"
          accessibilityLabel="Retour aux jeux"
          hitSlop={10}
          onPress={onBack}
          className="h-9 w-9 items-center justify-center rounded-pill bg-ink-inverse/15"
        >
          <Feather name="chevron-left" size={22} color={colors.inkInverse} />
        </Pressable>
        <AppText className="font-display text-sm text-ink-inverse" style={{ letterSpacing: 1.5 }}>
          tk link
        </AppText>
        <View className="h-9 w-9" />
      </View>

      {/* Titre façon affiche */}
      <View className="px-5 pb-3 pt-1">
        <AppText
          variant="display"
          className="text-ink-inverse"
          style={{ fontSize: 28, lineHeight: 34 }}
        >
          {title}
          {accent ? (
            <AppText variant="display" style={{ fontSize: 28, lineHeight: 34, color: GOLD }}>
              {' '}
              {accent}
            </AppText>
          ) : null}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" className="mt-1.5 text-ink-inverse/75">
            {subtitle}
          </AppText>
        ) : null}
      </View>

      {/* Corps du jeu */}
      {scroll ? (
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 pb-8"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View className="flex-1 justify-center px-5">{children}</View>
      )}

      {footer ? (
        <View className="px-5 pt-2" style={{ paddingBottom: insets.bottom + 12 }}>
          {footer}
        </View>
      ) : null}
    </View>
  );
}

/** Palette de la coquille, réutilisable par les jeux (accents sur fond rouge). */
export const gameTheme = {
  gold: GOLD,
  onRed: colors.inkInverse,
  onRedSoft: 'rgba(246,242,234,0.75)',
  line: colors.inkInverse,
};
