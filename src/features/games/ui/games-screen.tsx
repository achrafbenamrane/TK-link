import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText, Screen } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import type { CardImage } from '../model/memory';
import type { QuizItem } from '../model/quiz';
import { GAME_TILES, playableGames, tileIsDark, type GameKey } from '../model/tiles';
import { GamePlayer } from './game-player';

type Props = {
  /** Réservoir d'images, injecté par la route depuis les offres du catalogue. */
  imagePool: CardImage[];
  /** Offres (titre + prix) pour le quiz, injectées par la route. */
  quizPool: QuizItem[];
  /** Mots courts (nourriture) pour les mots mêlés. */
  words: string[];
  /** Appelé quand un jeu est gagné — la route accorde alors le coupon. */
  onWin: () => void;
  /**
   * Flèche de retour. Absente quand l'écran est la racine d'un onglet : une
   * flèche qui renvoie ailleurs y désoriente plus qu'elle n'aide.
   */
  onBack?: () => void;
};

export function GamesScreen({ imagePool, quizPool, words, onWin, onBack }: Props) {
  const [mode, setMode] = useState<GameKey | null>(null);
  const back = () => setMode(null);

  const canPlay = playableGames({
    images: imagePool.length,
    quiz: quizPool.length,
    words: words.length,
  });

  // Chaque jeu ouvre sa propre coquille « affiche » plein écran.
  if (mode) {
    return (
      <GamePlayer
        game={mode}
        imagePool={imagePool}
        quizPool={quizPool}
        words={words}
        onWin={onWin}
        onExit={back}
      />
    );
  }

  return (
    <Screen testID="games-screen">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-10">
        {/* Hero */}
        <View className="flex-row items-center gap-3 pb-2 pt-1">
          {onBack ? (
            <Pressable
              testID="games-back"
              accessibilityRole="button"
              accessibilityLabel="Retour"
              hitSlop={10}
              onPress={onBack}
            >
              <Feather name="chevron-left" size={26} color={colors.ink} />
            </Pressable>
          ) : null}
          <View>
            <AppText variant="display" className="text-3xl">
              Jeux
            </AppText>
            <AppText variant="caption" className="mt-0.5">
              Jouez, gagnez des coupons.
            </AppText>
          </View>
        </View>

        {/* Grille de jeux */}
        <View className="mt-4 flex-row flex-wrap justify-between gap-y-4">
          {GAME_TILES.map((t, index) => {
            const disabled = !canPlay[t.key];
            return (
              <Pressable
                key={t.key}
                testID={`game-${t.key}`}
                accessibilityRole="button"
                accessibilityLabel={t.name}
                onPress={() => !disabled && setMode(t.key)}
                disabled={disabled}
                className={cn(
                  'w-[47%] overflow-hidden rounded-card p-4',
                  // Deux colonnes : damier, sinon on obtient deux colonnes unies.
                  tileIsDark(index, 2) ? 'bg-ink' : 'bg-brand-500',
                  disabled && 'opacity-55',
                )}
                style={{ aspectRatio: 0.86 }}
              >
                <View className="h-11 w-11 items-center justify-center rounded-control bg-ink-inverse/15">
                  <Feather name={t.icon} size={22} color={colors.inkInverse} />
                </View>
                <View className="mt-auto gap-0.5">
                  <AppText className="font-sans-bold text-ink-inverse" style={{ fontSize: 16 }}>
                    {t.name}
                  </AppText>
                  <AppText variant="caption" className="text-ink-inverse/70">
                    {t.tagline}
                  </AppText>
                  <View className="mt-2 flex-row items-center gap-1.5">
                    <Feather
                      name={disabled ? 'lock' : 'play'}
                      size={13}
                      color={colors.inkInverse}
                    />
                    <AppText variant="caption" className="text-xs text-ink-inverse">
                      {disabled ? 'Plus d’offres' : 'Jouer'}
                    </AppText>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View className="mt-6 flex-row items-center gap-2 rounded-card bg-surface-muted p-4">
          <Feather name="gift" size={18} color={colors.brand600} />
          <AppText variant="caption" className="flex-1 text-ink-muted">
            Chaque victoire débloque un{' '}
            <AppText className="font-sans-bold text-ink">coupon</AppText> à utiliser sur votre
            prochaine commande.
          </AppText>
        </View>
      </ScrollView>
    </Screen>
  );
}
