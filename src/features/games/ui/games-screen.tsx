import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText, Screen } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import type { CardImage } from '../model/memory';
import { MemoryGame } from './memory-game';

type Props = {
  /** Réservoir d'images, injecté par la route depuis les offres du catalogue. */
  imagePool: CardImage[];
  /** Appelé quand un jeu est gagné — la route accorde alors le coupon. */
  onWin: () => void;
};

/** Feuille de route : les autres jeux vus en inspiration, à venir. */
const SOON: { icon: 'grid' | 'hash' | 'type' | 'zap'; label: string }[] = [
  { icon: 'grid', label: 'Labyrinthe' },
  { icon: 'zap', label: 'Quiz express' },
  { icon: 'type', label: 'Mots mêlés' },
  { icon: 'hash', label: 'Morpion' },
];

export function GamesScreen({ imagePool, onWin }: Props) {
  const router = useRouter();
  const [playing, setPlaying] = useState(false);

  const canPlay = imagePool.length >= 3;

  if (playing) {
    return (
      <Screen testID="games-screen">
        <View className="flex-row items-center gap-3 pb-3 pt-1">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={10}
            onPress={() => setPlaying(false)}
          >
            <Feather name="chevron-left" size={26} color={colors.ink} />
          </Pressable>
          <AppText variant="title" className="text-lg">
            Cartes mémoire
          </AppText>
        </View>
        <MemoryGame images={imagePool} onWin={onWin} onExit={() => setPlaying(false)} />
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

        {/* Jeu jouable — les cartes sont les vraies images des offres. */}
        <Pressable
          testID="game-memory"
          accessibilityRole="button"
          onPress={() => canPlay && setPlaying(true)}
          disabled={!canPlay}
          className={cn(
            'mb-5 mt-4 overflow-hidden rounded-card bg-ink p-5',
            !canPlay && 'opacity-60',
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
          {!canPlay ? (
            <AppText variant="caption" className="mt-3 text-ink-inverse/60">
              Il faut au moins 3 offres avec photo pour jouer.
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
