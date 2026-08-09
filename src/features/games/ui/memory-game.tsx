import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
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
/** Paires par partie — 4 → grille propre 4×2, cartes bien lisibles. */
const PAIRS = 4;

type Props = {
  images: CardImage[];
  onWin: () => void;
  onExit: () => void;
};

/**
 * Carte qui se retourne : dos crème avec emblème doré (identique pour toutes,
 * comme un vrai jeu de mémoire), face = la photo de l'offre en médaillon.
 * Taille NUMÉRIQUE (pas d'`aspect-ratio` sur une feuille à enfants absolus, qui
 * s'effondrait en barre).
 */
function FlipCard({
  card,
  label,
  size,
  revealed,
  matched,
  onPress,
}: {
  card: Card;
  label: string;
  size: number;
  revealed: boolean;
  matched: boolean;
  onPress: () => void;
}) {
  const p = useSharedValue(revealed ? 1 : 0);
  useEffect(() => {
    p.value = withTiming(revealed ? 1 : 0, { duration: 300 });
  }, [revealed, p]);

  const radius = size * 0.24;
  const face = { position: 'absolute' as const, top: 0, left: 0, width: size, height: size };

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
      disabled={revealed}
      style={{ width: size, height: size }}
    >
      {/* Dos : carte crème + emblème doré (toutes identiques). */}
      <Animated.View
        style={[
          face,
          back,
          {
            borderRadius: radius,
            backgroundColor: colors.inkInverse,
            alignItems: 'center',
            justifyContent: 'center',
          },
        ]}
      >
        <View
          style={{
            width: size * 0.46,
            height: size * 0.46,
            borderRadius: size * 0.23,
            backgroundColor: 'rgba(255,194,75,0.18)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Feather name="gift" size={size * 0.24} color={gameTheme.gold} />
        </View>
      </Animated.View>

      {/* Face : la photo de l'offre, médaillon. Anneau doré si paire trouvée. */}
      <Animated.View
        style={[
          face,
          front,
          {
            borderRadius: radius,
            overflow: 'hidden',
            backgroundColor: colors.inkInverse,
            borderWidth: matched ? 3 : 0,
            borderColor: gameTheme.gold,
          },
        ]}
      >
        <Image source={card.source} style={{ flex: 1 }} contentFit="cover" />
        {matched ? (
          <View
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              width: size * 0.3,
              height: size * 0.3,
              borderRadius: size * 0.15,
              backgroundColor: gameTheme.gold,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="check" size={size * 0.18} color={colors.ink} />
          </View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

export function MemoryGame({ images, onWin, onExit }: Props) {
  const { width } = useWindowDimensions();
  const [game, setGame] = useState<Game>(() => newGame(images, PAIRS));
  // Drapeau « victoire déjà signalée » en REF : rien ne l'affiche, donc le
  // passer en state ne ferait qu'ajouter un rendu en cascade depuis l'effet.
  const wonNotified = useRef(false);
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
    if (won && !wonNotified.current) {
      wonNotified.current = true;
      onWin();
    }
  }, [won, onWin]);

  const restart = () => {
    wonNotified.current = false;
    setTimedOut(false);
    setRound((r) => r + 1);
    setGame(newGame(images, PAIRS));
  };

  const tries = triesLeft(game);

  // Grille : `pairs` colonnes × 2 lignes — toujours un rectangle net.
  const cols = Math.max(2, game.pairs);
  const GAP = 12;
  const CARD = Math.floor((width - 40 - GAP * (cols - 1)) / cols);

  return (
    <GameShell
      title="TROUVEZ LES"
      accent="PAIRES"
      subtitle={`${game.matched.length}/${game.pairs} paires trouvées`}
      onBack={onExit}
      footer={
        <View className="flex-row items-center justify-center gap-2">
          <Feather name="gift" size={15} color={gameTheme.gold} />
          <AppText variant="caption" className="text-ink-inverse/70">
            Retournez deux cartes identiques. Chaque victoire donne un coupon.
          </AppText>
        </View>
      }
    >
      <View className="mt-2 items-center">
        <TimerPill remaining={remaining} low={remaining <= 8} />

        {/* Cœurs = essais restants */}
        <View className="mb-6 mt-1 flex-row items-center gap-2">
          {Array.from({ length: game.maxMistakes }).map((_, i) => (
            <Feather
              key={i}
              name="heart"
              size={22}
              color={i < tries ? gameTheme.gold : 'rgba(246,242,234,0.3)'}
            />
          ))}
        </View>

        {/* Plateau de cartes */}
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: GAP,
            maxWidth: width - 40,
          }}
        >
          {game.cards.map((c, i) => (
            <FlipCard
              key={c.id}
              card={c}
              label={String(i + 1)}
              size={CARD}
              revealed={isRevealed(game, c)}
              matched={game.matched.includes(c.imageId)}
              onPress={() => !over && setGame((g) => flipCard(g, c.id))}
            />
          ))}
        </View>
      </View>

      {/* Fin de partie */}
      {over ? (
        <View
          testID="memory-result"
          className="mt-8 items-center gap-3 rounded-card bg-ink-inverse p-6"
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
                {won ? 'Rejouer' : 'Nouvelle partie'}
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
