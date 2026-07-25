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

/** Temps imparti (secondes) pour atteindre l'offre — sinon, perdu. */
const BUDGET = 20;
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

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
  const [startTs, setStartTs] = useState(() => Date.now());
  const [remaining, setRemaining] = useState(BUDGET);
  const [timedOut, setTimedOut] = useState(false);

  const won = game.status === 'won';
  const over = won || timedOut;

  useEffect(() => {
    if (won && !wonNotified) {
      setWonNotified(true);
      onWin();
    }
  }, [won, wonNotified, onWin]);

  // Compte à REBOURS : chaque partie a BUDGET secondes ; à 0, c'est perdu.
  useEffect(() => {
    if (over) return;
    const id = setInterval(() => {
      const rem = Math.max(0, BUDGET - Math.floor((Date.now() - startTs) / 1000));
      setRemaining(rem);
      if (rem <= 0) setTimedOut(true);
    }, 250);
    return () => clearInterval(id);
  }, [over, startTs]);

  const go = (d: Dir) => {
    if (!over) setGame((g) => move(g, d));
  };

  // Nouveau labyrinthe ALÉATOIRE à chaque partie → rien à mémoriser d'une fois
  // sur l'autre. (newMaze est aussi rappelé à chaque entrée dans le jeu.)
  const restart = () => {
    setWonNotified(false);
    setStartTs(Date.now());
    setRemaining(BUDGET);
    setTimedOut(false);
    setGame(newMaze());
  };

  const size = game.size;
  const low = remaining <= 8;

  return (
    <GameShell
      title="TROUVEZ LE"
      accent="CHEMIN"
      subtitle="Chemins multiples — arrivez avant la fin du temps."
      onBack={onExit}
    >
      {/* Compte à rebours (rouge quand il reste peu) */}
      <View
        className="mb-3 self-center rounded-pill px-4 py-1.5"
        style={{ backgroundColor: low ? colors.danger : 'rgba(246,242,234,0.16)' }}
      >
        <AppText
          className="font-display text-ink-inverse"
          style={{ fontSize: 15, letterSpacing: 1 }}
        >
          {`⏱ ${fmtTime(remaining)}`}
        </AppText>
      </View>

      {/* Labyrinthe : murs blancs sur rouge */}
      <View className="mt-1 self-center" style={{ width: '100%', maxWidth: 330, aspectRatio: 1 }}>
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

      {over ? (
        <View
          testID="maze-result"
          className="mt-6 items-center gap-3 rounded-card bg-ink-inverse p-6"
        >
          <View
            className="h-14 w-14 items-center justify-center rounded-pill"
            style={{ backgroundColor: won ? colors.brand50 : colors.surfaceSunken }}
          >
            <Feather
              name={won ? 'gift' : 'clock'}
              size={26}
              color={won ? colors.brand500 : colors.inkMuted}
            />
          </View>
          <AppText variant="title" className="text-center text-xl">
            {won ? `Arrivé ! Coupon débloqué 🎉` : 'Temps écoulé — on retente ?'}
          </AppText>
          <AppText variant="caption" className="text-center">
            {won
              ? `Avec ${fmtTime(remaining)} d’avance · dans « Mes coupons ».`
              : 'Un nouveau labyrinthe vous attend.'}
          </AppText>
          <View className="mt-1 w-full gap-2">
            <Pressable
              testID="maze-restart"
              accessibilityRole="button"
              onPress={restart}
              className="items-center rounded-control bg-brand-500 py-3.5 active:bg-brand-600"
            >
              <AppText className="font-sans-bold text-ink-inverse">
                {won ? 'Rejouer' : 'Nouveau labyrinthe'}
              </AppText>
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
