import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText, Screen } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import type { CardImage } from '../model/memory';
import type { QuizItem } from '../model/quiz';
import { MazeGame } from './maze-game';
import { MemoryGame } from './memory-game';
import { MorpionGame } from './morpion-game';
import { PacmanGame } from './pacman-game';
import { QuizGame } from './quiz-game';
import { WordSearchGame } from './wordsearch-game';

type Props = {
  /** Réservoir d'images, injecté par la route depuis les offres du catalogue. */
  imagePool: CardImage[];
  /** Offres (titre + prix) pour le quiz, injectées par la route. */
  quizPool: QuizItem[];
  /** Mots courts (nourriture) pour les mots mêlés. */
  words: string[];
  /** Appelé quand un jeu est gagné — la route accorde alors le coupon. */
  onWin: () => void;
};

type Mode = 'menu' | 'memory' | 'quiz' | 'morpion' | 'maze' | 'wordsearch' | 'pacman';

type Tile = {
  key: Exclude<Mode, 'menu'>;
  name: string;
  tagline: string;
  icon: 'grid' | 'zap' | 'hash' | 'navigation' | 'type' | 'disc';
  /** Fond de la tuile : rouge de marque (false) ou ink (true). */
  dark: boolean;
};

const TILES: Tile[] = [
  {
    key: 'memory',
    name: 'Trouvez les paires',
    tagline: 'Retrouvez les duos',
    icon: 'grid',
    dark: false,
  },
  { key: 'morpion', name: 'Morpion', tagline: 'Alignez trois plats', icon: 'hash', dark: true },
  { key: 'maze', name: 'Labyrinthe', tagline: 'Trouvez le chemin', icon: 'navigation', dark: true },
  {
    key: 'wordsearch',
    name: 'Mots mêlés',
    tagline: 'Cachés dans la grille',
    icon: 'type',
    dark: false,
  },
  {
    key: 'quiz',
    name: 'Le juste prix',
    tagline: 'Devinez le prix flash',
    icon: 'zap',
    dark: false,
  },
  {
    key: 'pacman',
    name: 'PacFreedoo',
    tagline: 'Croquez tout au joystick',
    icon: 'disc',
    dark: true,
  },
];

export function GamesScreen({ imagePool, quizPool, words, onWin }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('menu');
  const back = () => setMode('menu');
  const goal = imagePool[0];

  const canPlay: Record<Tile['key'], boolean> = {
    memory: imagePool.length >= 3,
    morpion: imagePool.length >= 2,
    maze: imagePool.length >= 1,
    wordsearch: words.length >= 3,
    quiz: quizPool.length >= 3,
    pacman: imagePool.length >= 1,
  };

  // Chaque jeu ouvre sa propre coquille « affiche » plein écran.
  if (mode === 'memory') return <MemoryGame images={imagePool} onWin={onWin} onExit={back} />;
  if (mode === 'morpion') return <MorpionGame images={imagePool} onWin={onWin} onExit={back} />;
  if (mode === 'maze' && goal) return <MazeGame goalImage={goal} onWin={onWin} onExit={back} />;
  if (mode === 'wordsearch') return <WordSearchGame words={words} onWin={onWin} onExit={back} />;
  if (mode === 'quiz') return <QuizGame pool={quizPool} onWin={onWin} onExit={back} />;
  if (mode === 'pacman') return <PacmanGame images={imagePool} onWin={onWin} onExit={back} />;

  return (
    <Screen testID="games-screen">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-10">
        {/* Hero */}
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

        {/* Grille de jeux */}
        <View className="mt-4 flex-row flex-wrap justify-between gap-y-4">
          {TILES.map((t) => {
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
                  t.dark ? 'bg-ink' : 'bg-brand-500',
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
