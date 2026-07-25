import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import type { CardImage } from '../model/memory';
import { move, newMaze, type Maze } from '../model/maze';
import { GameShell, gameTheme } from './game-shell';

type Props = {
  /** Le visuel de l'offre à atteindre (au bout du labyrinthe). */
  goalImage: CardImage;
  onWin: () => void;
  onExit: () => void;
};

type Dir = 'up' | 'down' | 'left' | 'right';

function DirButton({
  dir,
  icon,
  onPress,
}: {
  dir: Dir;
  icon: 'arrow-up' | 'arrow-down' | 'arrow-left' | 'arrow-right';
  onPress: (d: Dir) => void;
}) {
  return (
    <Pressable
      testID={`maze-${dir}`}
      accessibilityRole="button"
      accessibilityLabel={dir}
      onPress={() => onPress(dir)}
      className="h-14 w-14 items-center justify-center rounded-control bg-ink-inverse active:opacity-80"
    >
      <Feather name={icon} size={24} color={colors.ink} />
    </Pressable>
  );
}

export function MazeGame({ goalImage, onWin, onExit }: Props) {
  const [game, setGame] = useState<Maze>(() => newMaze());
  const [wonNotified, setWonNotified] = useState(false);

  useEffect(() => {
    if (game.status === 'won' && !wonNotified) {
      setWonNotified(true);
      onWin();
    }
  }, [game.status, wonNotified, onWin]);

  const go = (d: Dir) => setGame((g) => move(g, d));
  const restart = () => {
    setWonNotified(false);
    setGame(newMaze());
  };

  const size = game.size;
  const won = game.status === 'won';

  return (
    <GameShell
      title="TROUVEZ LE"
      accent="CHEMIN"
      subtitle="Guidez le point jusqu’à l’offre."
      onBack={onExit}
    >
      {/* Labyrinthe : murs blancs sur rouge */}
      <View className="mt-2 self-center" style={{ width: '100%', maxWidth: 330, aspectRatio: 1 }}>
        {Array.from({ length: size }).map((_, r) => (
          <View key={r} className="flex-1 flex-row">
            {Array.from({ length: size }).map((_, c) => {
              const i = r * size + c;
              const w = game.walls[i];
              const isPlayer = game.player === i;
              const isGoal = game.goal === i;
              return (
                <View
                  key={c}
                  className="flex-1 items-center justify-center"
                  style={{
                    borderColor: colors.inkInverse,
                    borderTopWidth: w?.top ? 3 : 0,
                    borderLeftWidth: w?.left ? 3 : 0,
                    borderRightWidth: c === size - 1 && w?.right ? 3 : 0,
                    borderBottomWidth: r === size - 1 && w?.bottom ? 3 : 0,
                  }}
                >
                  {isGoal ? (
                    <View className="h-[80%] w-[80%] overflow-hidden rounded-pill">
                      <Image source={goalImage.source} style={{ flex: 1 }} contentFit="cover" />
                    </View>
                  ) : null}
                  {isPlayer && !isGoal ? (
                    <View
                      className="h-[46%] w-[46%] rounded-pill"
                      style={{ backgroundColor: gameTheme.gold }}
                    />
                  ) : null}
                </View>
              );
            })}
          </View>
        ))}
      </View>

      {won ? (
        <View
          testID="maze-result"
          className="mt-6 items-center gap-3 rounded-card bg-ink-inverse p-6"
        >
          <View
            className="h-14 w-14 items-center justify-center rounded-pill"
            style={{ backgroundColor: colors.brand50 }}
          >
            <Feather name="gift" size={26} color={colors.brand500} />
          </View>
          <AppText variant="title" className="text-center text-xl">
            Arrivé ! Coupon débloqué 🎉
          </AppText>
          <AppText variant="caption" className="text-center">
            Votre coupon vous attend dans « Mes coupons ».
          </AppText>
          <View className="mt-1 w-full gap-2">
            <Pressable
              testID="maze-restart"
              accessibilityRole="button"
              onPress={restart}
              className="items-center rounded-control bg-brand-500 py-3.5 active:bg-brand-600"
            >
              <AppText className="font-sans-bold text-ink-inverse">Nouveau labyrinthe</AppText>
            </Pressable>
            <Pressable
              testID="maze-exit"
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
      ) : (
        /* Croix directionnelle */
        <View className="mt-7 items-center gap-2">
          <DirButton dir="up" icon="arrow-up" onPress={go} />
          <View className="flex-row items-center gap-2">
            <DirButton dir="left" icon="arrow-left" onPress={go} />
            <View className="h-14 w-14" />
            <DirButton dir="right" icon="arrow-right" onPress={go} />
          </View>
          <DirButton dir="down" icon="arrow-down" onPress={go} />
        </View>
      )}
    </GameShell>
  );
}
