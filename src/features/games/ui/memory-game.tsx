import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { cn } from '@/shared/lib/cn';
import { AppText } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import {
  dismiss,
  flipCard,
  isMismatchPending,
  isRevealed,
  newGame,
  triesLeft,
  type Card,
  type CardImage,
  type MemoryGame as Game,
} from '../model/memory';

type Props = {
  images: CardImage[];
  onWin: () => void;
  onExit: () => void;
};

/** Une carte qui se retourne (rotateY). Deux faces, dos de marque / visuel. */
function FlipCard({
  card,
  revealed,
  onPress,
}: {
  card: Card;
  revealed: boolean;
  onPress: () => void;
}) {
  const p = useSharedValue(revealed ? 1 : 0);
  useEffect(() => {
    p.value = withTiming(revealed ? 1 : 0, { duration: 320 });
  }, [revealed, p]);

  const back = useAnimatedStyle(() => ({
    transform: [{ perspective: 800 }, { rotateY: `${interpolate(p.value, [0, 1], [0, 180])}deg` }],
    opacity: p.value < 0.5 ? 1 : 0,
  }));
  const front = useAnimatedStyle(() => ({
    transform: [
      { perspective: 800 },
      { rotateY: `${interpolate(p.value, [0, 1], [180, 360])}deg` },
    ],
    opacity: p.value < 0.5 ? 0 : 1,
  }));

  return (
    <Pressable
      testID={`card-${card.id}`}
      accessibilityRole="button"
      accessibilityLabel={revealed ? 'Carte retournée' : 'Carte face cachée'}
      onPress={onPress}
      className="aspect-square w-[31%]"
    >
      {/* Dos : tuile ink avec le point rouge de la marque. */}
      <Animated.View
        style={back}
        className="absolute inset-0 items-center justify-center rounded-card bg-ink"
      >
        <View className="h-4 w-4 rounded-pill bg-brand-500" />
      </Animated.View>
      {/* Face : le visuel de l'offre. */}
      <Animated.View
        style={front}
        className="absolute inset-0 overflow-hidden rounded-card border border-line bg-surface"
      >
        <Image source={card.source} style={{ flex: 1 }} contentFit="cover" />
      </Animated.View>
    </Pressable>
  );
}

export function MemoryGame({ images, onWin, onExit }: Props) {
  const [game, setGame] = useState<Game>(() => newGame(images));
  const [wonNotified, setWonNotified] = useState(false);

  // Erreur : on montre les deux cartes ~900 ms, puis on les referme.
  useEffect(() => {
    if (!isMismatchPending(game)) return;
    const t = setTimeout(() => setGame((g) => dismiss(g)), 900);
    return () => clearTimeout(t);
  }, [game]);

  // Victoire signalée une seule fois (récompense côté appelant).
  useEffect(() => {
    if (game.status === 'won' && !wonNotified) {
      setWonNotified(true);
      onWin();
    }
  }, [game.status, wonNotified, onWin]);

  const restart = () => {
    setWonNotified(false);
    // Images FRAÎCHES à chaque relance (tirage aléatoire dans le pool).
    setGame(newGame(images));
  };

  const tries = triesLeft(game);

  return (
    <View className="flex-1">
      {/* En-tête : consigne + essais restants */}
      <View className="mb-4 flex-row items-center justify-between">
        <View>
          <AppText className="font-sans-bold text-ink">Retrouvez les 3 paires</AppText>
          <AppText variant="caption" className="text-ink-faint">
            {game.matched.length}/{game.pairs} trouvées
          </AppText>
        </View>
        <View className="flex-row items-center gap-1.5">
          {Array.from({ length: game.maxMistakes }).map((_, i) => (
            <Feather
              key={i}
              name="heart"
              size={18}
              color={i < tries ? colors.brand500 : colors.line}
            />
          ))}
        </View>
      </View>

      {/* Plateau */}
      <View className="flex-row flex-wrap justify-between gap-y-3">
        {game.cards.map((c) => (
          <FlipCard
            key={c.id}
            card={c}
            revealed={isRevealed(game, c)}
            onPress={() => setGame((g) => flipCard(g, c.id))}
          />
        ))}
      </View>

      {/* Fin de partie */}
      {game.status !== 'playing' ? (
        <View
          testID="memory-result"
          className="mt-6 items-center gap-3 rounded-card border border-line bg-surface-muted p-6"
        >
          <View
            className={cn(
              'h-14 w-14 items-center justify-center rounded-pill',
              game.status === 'won' ? 'bg-brand-50' : 'bg-surface-sunken',
            )}
          >
            <Feather
              name={game.status === 'won' ? 'gift' : 'refresh-ccw'}
              size={26}
              color={game.status === 'won' ? colors.brand500 : colors.inkMuted}
            />
          </View>
          <AppText variant="title" className="text-center text-xl">
            {game.status === 'won' ? 'Gagné ! Coupon débloqué 🎉' : 'Perdu — on retente ?'}
          </AppText>
          <AppText variant="caption" className="text-center">
            {game.status === 'won'
              ? 'Votre coupon vous attend dans « Mes coupons ».'
              : 'De nouvelles images vous attendent.'}
          </AppText>
          <View className="mt-1 w-full gap-2">
            <Pressable
              testID="memory-restart"
              accessibilityRole="button"
              onPress={restart}
              className="items-center rounded-control bg-brand-500 py-3.5 active:bg-brand-600"
            >
              <AppText className="font-sans-bold text-ink-inverse">
                {game.status === 'won' ? 'Rejouer' : 'Nouvelle partie'}
              </AppText>
            </Pressable>
            <Pressable
              testID="memory-exit"
              accessibilityRole="button"
              onPress={onExit}
              className="py-2"
            >
              <AppText variant="caption" className="text-center text-ink-muted">
                Retour aux jeux
              </AppText>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}
