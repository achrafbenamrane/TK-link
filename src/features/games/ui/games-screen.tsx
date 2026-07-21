import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText, Screen } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import type { CardImage } from '../model/memory';
import type { QuizItem } from '../model/quiz';
import { MemoryGame } from './memory-game';
import { QuizGame } from './quiz-game';

type Props = {
  /** Réservoir d'images, injecté par la route depuis les offres du catalogue. */
  imagePool: CardImage[];
  /** Offres (titre + prix) pour le quiz, injectées par la route. */
  quizPool: QuizItem[];
  /** Appelé quand un jeu est gagné — la route accorde alors le coupon. */
  onWin: () => void;
};

type Mode = 'menu' | 'memory' | 'quiz';

/** Feuille de route : les autres jeux vus en inspiration, à venir. */
const SOON: { icon: 'grid' | 'hash' | 'type'; label: string }[] = [
  { icon: 'grid', label: 'Labyrinthe' },
  { icon: 'type', label: 'Mots mêlés' },
  { icon: 'hash', label: 'Morpion' },
];

/** En-tête d'une partie : retour au menu des jeux. */
function GameHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View className="flex-row items-center gap-3 pb-3 pt-1">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Retour"
        hitSlop={10}
        onPress={onBack}
      >
        <Feather name="chevron-left" size={26} color={colors.ink} />
      </Pressable>
      <AppText variant="title" className="text-lg">
        {title}
      </AppText>
    </View>
  );
}

export function GamesScreen({ imagePool, quizPool, onWin }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('menu');

  const canPlayMemory = imagePool.length >= 3;
  const canPlayQuiz = quizPool.length >= 3;
  const back = () => setMode('menu');

  if (mode === 'memory') {
    return (
      <Screen testID="games-screen">
        <GameHeader title="Cartes mémoire" onBack={back} />
        <MemoryGame images={imagePool} onWin={onWin} onExit={back} />
      </Screen>
    );
  }

  if (mode === 'quiz') {
    return (
      <Screen testID="games-screen">
        <GameHeader title="Le juste prix" onBack={back} />
        <QuizGame pool={quizPool} onWin={onWin} onExit={back} />
      </Screen>
    );
  }

  return (
    <Screen testID="games-screen">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-10">
        <View className="flex-row items-center gap-3 pb-2 pt-1">
          <Pressable
            testID="games-back"
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={10}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          >
            <Feather name="chevron-left" size={26} color={colors.ink} />
          </Pressable>
          <View>
            <AppText variant="display" className="text-3xl">
              Jeux
            </AppText>
            <AppText variant="caption" className="mt-0.5">
              Jouez, gagnez des coupons.
            </AppText>
          </View>
        </View>

        {/* Cartes mémoire — les cartes sont les vraies images des offres. */}
        <Pressable
          testID="game-memory"
          accessibilityRole="button"
          onPress={() => canPlayMemory && setMode('memory')}
          disabled={!canPlayMemory}
          className={cn(
            'mb-3 mt-4 overflow-hidden rounded-card bg-ink p-5',
            !canPlayMemory && 'opacity-60',
          )}
        >
          <View className="flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-control bg-brand-500">
              <Feather name="layers" size={22} color={colors.inkInverse} />
            </View>
            <View className="flex-1">
              <AppText className="font-sans-bold text-ink-inverse" style={{ fontSize: 17 }}>
                Cartes mémoire
              </AppText>
              <AppText variant="caption" className="text-ink-inverse/60">
                Retrouvez 3 paires en 3 essais. Un coupon à la clé.
              </AppText>
            </View>
            <Feather name="play" size={20} color={colors.brand500} />
          </View>
          {!canPlayMemory ? (
            <AppText variant="caption" className="mt-3 text-ink-inverse/60">
              Il faut au moins 3 offres avec photo pour jouer.
            </AppText>
          ) : null}
        </Pressable>

        {/* Le juste prix — devinez le prix flash des offres. */}
        <Pressable
          testID="game-quiz"
          accessibilityRole="button"
          onPress={() => canPlayQuiz && setMode('quiz')}
          disabled={!canPlayQuiz}
          className={cn(
            'mb-5 overflow-hidden rounded-card bg-ink p-5',
            !canPlayQuiz && 'opacity-60',
          )}
        >
          <View className="flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-control bg-brand-500">
              <Feather name="zap" size={22} color={colors.inkInverse} />
            </View>
            <View className="flex-1">
              <AppText className="font-sans-bold text-ink-inverse" style={{ fontSize: 17 }}>
                Le juste prix
              </AppText>
              <AppText variant="caption" className="text-ink-inverse/60">
                Devinez le prix flash des offres. Un coupon à gagner.
              </AppText>
            </View>
            <Feather name="play" size={20} color={colors.brand500} />
          </View>
          {!canPlayQuiz ? (
            <AppText variant="caption" className="mt-3 text-ink-inverse/60">
              Il faut au moins 3 offres pour jouer.
            </AppText>
          ) : null}
        </Pressable>

        <AppText variant="title" className="mb-3 text-lg">
          Bientôt
        </AppText>
        <View className="flex-row flex-wrap gap-3">
          {SOON.map((g) => (
            <View
              key={g.label}
              className="w-[47%] gap-2 rounded-card border border-line bg-surface-muted p-4"
            >
              <Feather name={g.icon} size={20} color={colors.inkFaint} />
              <AppText className="font-sans-semibold text-ink-muted">{g.label}</AppText>
              <AppText variant="caption" className="text-xs text-ink-faint">
                À venir
              </AppText>
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}
