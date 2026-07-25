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
import { GameShell, TimerPill, gameTheme } from './game-shell';
import { useCountdown } from './use-countdown';

/** Temps imparti (secondes) pour retrouver toutes les paires. */
const BUDGET = 45;

type Props = {
  images: CardImage[];
  onWin: () => void;
  onExit: () => void;
};

/** Pastille circulaire qui se retourne : dos numéroté (crème), face = la photo. */
function FlipCard({
  card,
  label,
  revealed,
  onPress,
}: {
  card: Card;
  label: string;
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
      accessibilityLabel={revealed ? 'Carte retournée' : `Carte ${label}`}
      onPress={onPress}
      className="mb-3 aspect-square w-[30%]"
    >
      {/* Dos : pastille crème numérotée, façon « trouvez les paires ». */}
      <Animated.View
        style={back}
        className="absolute inset-0 items-center justify-center rounded-full border-4 border-ink-inverse/30 bg-ink-inverse"
      >
        <AppText className="font-display text-ink" style={{ fontSize: 22 }}>
          {label}
        </AppText>
      </Animated.View>
      {/* Face : le visuel de l'offre, en médaillon. */}
      <Animated.View
        style={front}
        className="absolute inset-0 overflow-hidden rounded-full border-4 border-ink-inverse"
      >
        <Image source={card.source} style={{ flex: 1 }} contentFit="cover" />
      </Animated.View>
    </Pressable>
  );
}

export function MemoryGame({ images, onWin, onExit }: Props) {
  const [game, setGame] = useState<Game>(() => newGame(images, 5));
  const [wonNotified, setWonNotified] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [round, setRound] = useState(0);

  const won = game.status === 'won';
  const over = game.status !== 'playing' || timedOut;

  const remaining = useCountdown(BUDGET, !over, () => setTimedOut(true), round);

  // Erreur : on montre les deux cartes ~900 ms, puis on les referme.
  useEffect(() => {
    if (!isMismatchPending(game)) return;
    const t = setTimeout(() => setGame((g) => dismiss(g)), 900);
    return () => clearTimeout(t);
  }, [game]);

  // Victoire signalée une seule fois (récompense côté appelant).
  useEffect(() => {
    if (won && !wonNotified) {
      setWonNotified(true);
      onWin();
    }
  }, [won, wonNotified, onWin]);

  const restart = () => {
    setWonNotified(false);
    setTimedOut(false);
    setRound((r) => r + 1);
    setGame(newGame(images, 5));
  };

  const tries = triesLeft(game);

  return (
    <GameShell
      title="TROUVEZ LES"
      accent="PAIRES"
      subtitle={`${game.matched.length}/${game.pairs} trouvées · ${game.pairs} paires, ${game.maxMistakes} essais`}
      onBack={onExit}
    >
      <TimerPill remaining={remaining} low={remaining <= 8} />

      {/* Cœurs = essais restants */}
      <View className="mb-4 flex-row items-center gap-1.5">
        {Array.from({ length: game.maxMistakes }).map((_, i) => (
          <Feather
            key={i}
            name="heart"
            size={20}
            color={i < tries ? gameTheme.gold : 'rgba(246,242,234,0.35)'}
          />
        ))}
      </View>

      {/* Plateau de pastilles */}
      <View className="flex-row flex-wrap justify-between">
        {game.cards.map((c, i) => (
          <FlipCard
            key={c.id}
            card={c}
            label={String(i + 1)}
            revealed={isRevealed(game, c)}
            onPress={() => !over && setGame((g) => flipCard(g, c.id))}
          />
        ))}
      </View>

      {/* Fin de partie */}
      {over ? (
        <View
          testID="memory-result"
          className="mt-4 items-center gap-3 rounded-card bg-ink-inverse p-6"
        >
          <View
            className="h-14 w-14 items-center justify-center rounded-pill"
            style={{ backgroundColor: won ? colors.brand50 : colors.surfaceSunken }}
          >
            <Feather
              name={won ? 'gift' : timedOut ? 'clock' : 'refresh-ccw'}
              size={26}
              color={won ? colors.brand500 : colors.inkMuted}
            />
          </View>
          <AppText variant="title" className="text-center text-xl">
            {won
              ? 'Gagné ! Coupon débloqué 🎉'
              : timedOut
                ? 'Temps écoulé — on retente ?'
                : 'Perdu — on retente ?'}
          </AppText>
          <AppText variant="caption" className="text-center">
            {won
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
    </GameShell>
  );
}
