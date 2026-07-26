import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { memo, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { AppText } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import type { CardImage } from '../model/memory';
import { newPacGame, tick, type PacGame, type Walls } from '../model/pacman';
import { GameShell, gameTheme } from './game-shell';

type Props = {
  /** Photos des offres — servent de « food » à croquer. */
  images: CardImage[];
  onWin: () => void;
  onExit: () => void;
};

const COLS = 9;
const ROWS = 9;
const STEP = 150; // ms par pas (cadence logique)
// La glissade dure un peu plus qu'un pas : quand le pas suivant arrive, l'ancien
// mouvement est encore en cours → on redirige sans figer. Zéro micro-arrêt.
const TWEEN = STEP + 26;
const GHOST_COLORS = ['#ff6b5b', '#5bd6ff', '#c58bff'];

/** Une entité qui glisse doucement de case en case (Reanimated). */
function Mover({
  col,
  row,
  cell,
  children,
}: {
  col: number;
  row: number;
  cell: number;
  children: ReactNode;
}) {
  const x = useSharedValue(col * cell);
  const y = useSharedValue(row * cell);
  useEffect(() => {
    const tx = col * cell;
    const ty = row * cell;
    // saut long (réapparition après une vie perdue) → pas d'animation
    if (Math.abs(x.value - tx) > cell * 1.6 || Math.abs(y.value - ty) > cell * 1.6) {
      x.value = tx;
      y.value = ty;
    } else {
      x.value = withTiming(tx, { duration: TWEEN, easing: Easing.linear });
      y.value = withTiming(ty, { duration: TWEEN, easing: Easing.linear });
    }
  }, [col, row, cell, x, y]);
  const st = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }));
  return (
    <Animated.View style={[{ position: 'absolute', width: cell, height: cell }, st]}>
      {children}
    </Animated.View>
  );
}

/** Le perso : quartier « qui croque », orienté selon la direction. */
function PacSprite({ cell, angle, open }: { cell: number; angle: number; open: boolean }) {
  const R = cell * 0.42;
  const cx = cell / 2;
  const cy = cell / 2;
  const m = open ? 0.28 : 0.02;
  const a1 = m * Math.PI;
  const a2 = (2 - m) * Math.PI;
  const d = `M${cx},${cy} L${cx + R * Math.cos(a1)},${cy + R * Math.sin(a1)} A${R},${R} 0 1 1 ${cx + R * Math.cos(a2)},${cy + R * Math.sin(a2)} Z`;
  return (
    <View style={{ flex: 1, transform: [{ rotate: `${angle}deg` }] }}>
      <Svg width={cell} height={cell}>
        <Path d={d} fill="#ffffff" />
      </Svg>
    </View>
  );
}

/** Un fantôme (corps + yeux). Mémoïsé : le dessin ne change pas d'un pas à l'autre. */
const GhostSprite = memo(function GhostSprite({ cell, color }: { cell: number; color: string }) {
  const R = cell * 0.38;
  const cx = cell / 2;
  const cy = cell / 2 + cell * 0.04;
  const d = `M${cx - R},${cy + R * 0.85} L${cx - R},${cy} A${R},${R} 0 1 1 ${cx + R},${cy} L${cx + R},${cy + R * 0.85} l${-R * 0.5},${-R * 0.28} l${-R * 0.5},${R * 0.28} l${-R * 0.5},${-R * 0.28} l${-R * 0.5},${R * 0.28} Z`;
  return (
    <Svg width={cell} height={cell}>
      <Path d={d} fill={color} />
      <Circle cx={cx - R * 0.34} cy={cy - R * 0.12} r={R * 0.22} fill="#fff" />
      <Circle cx={cx + R * 0.34} cy={cy - R * 0.12} r={R * 0.22} fill="#fff" />
      <Circle cx={cx - R * 0.26} cy={cy - R * 0.06} r={R * 0.1} fill="#241436" />
      <Circle cx={cx + R * 0.42} cy={cy - R * 0.06} r={R * 0.1} fill="#241436" />
    </Svg>
  );
});

/** Les murs — statiques pendant une partie, donc mémoïsés. */
const WallsLayer = memo(function WallsLayer({ walls, cell }: { walls: Walls[]; cell: number }) {
  const lines: ReactNode[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const w = walls[r * COLS + c]!;
      const x = c * cell;
      const y = r * cell;
      const key = `${c}-${r}`;
      const stroke = gameTheme.gold;
      if (w.t)
        lines.push(
          <Line
            key={key + 't'}
            x1={x}
            y1={y}
            x2={x + cell}
            y2={y}
            stroke={stroke}
            strokeWidth={2.5}
            strokeLinecap="round"
          />,
        );
      if (w.l)
        lines.push(
          <Line
            key={key + 'l'}
            x1={x}
            y1={y}
            x2={x}
            y2={y + cell}
            stroke={stroke}
            strokeWidth={2.5}
            strokeLinecap="round"
          />,
        );
      if (c === COLS - 1 && w.r)
        lines.push(
          <Line
            key={key + 'r'}
            x1={x + cell}
            y1={y}
            x2={x + cell}
            y2={y + cell}
            stroke={stroke}
            strokeWidth={2.5}
            strokeLinecap="round"
          />,
        );
      if (r === ROWS - 1 && w.b)
        lines.push(
          <Line
            key={key + 'b'}
            x1={x}
            y1={y + cell}
            x2={x + cell}
            y2={y + cell}
            stroke={stroke}
            strokeWidth={2.5}
            strokeLinecap="round"
          />,
        );
    }
  }
  return (
    <Svg width={cell * COLS} height={cell * ROWS} style={{ position: 'absolute' }}>
      {lines}
    </Svg>
  );
});

/**
 * Toutes les pastilles dans UN seul SVG. Avant : ~75 vues natives recréées à
 * chaque pas, ce qui saturait le thread JS et rendait la cadence irrégulière
 * (→ à-coups). Un seul SVG rend chaque pas quasi gratuit côté natif.
 */
function DotsLayer({
  eaten,
  foodSet,
  cell,
}: {
  eaten: boolean[];
  foodSet: Set<number>;
  cell: number;
}) {
  const dots: ReactNode[] = [];
  for (let i = 0; i < eaten.length; i++) {
    if (eaten[i] || foodSet.has(i)) continue;
    const c = i % COLS;
    const r = (i / COLS) | 0;
    dots.push(
      <Circle key={i} cx={c * cell + cell / 2} cy={r * cell + cell / 2} r={2} fill="#f6efe0" />,
    );
  }
  return (
    <Svg
      width={cell * COLS}
      height={cell * ROWS}
      style={{ position: 'absolute' }}
      pointerEvents="none"
    >
      {dots}
    </Svg>
  );
}

/**
 * Les photos des offres (« food »). Mémoïsé sur une signature stable
 * (`eatenKey`) : ne se redessine QUE lorsqu'une photo est mangée — sinon les
 * `expo-image` se reconcilieraient à chaque pas (churn/scintillement).
 */
const FoodLayer = memo(function FoodLayer({
  food,
  images,
  eatenKey,
  cell,
}: {
  food: number[];
  images: CardImage[];
  eatenKey: string;
  cell: number;
}) {
  return (
    <>
      {food.map((cellIdx, k) => {
        if (eatenKey[k] === '1') return null;
        const img = images[k % Math.max(1, images.length)];
        if (!img) return null;
        const c = cellIdx % COLS;
        const r = (cellIdx / COLS) | 0;
        return (
          <View
            key={cellIdx}
            style={{
              position: 'absolute',
              left: c * cell,
              top: r * cell,
              width: cell,
              height: cell,
              padding: cell * 0.12,
            }}
          >
            <Image
              source={img.source}
              style={{ flex: 1, borderRadius: cell * 0.3 }}
              contentFit="cover"
            />
          </View>
        );
      })}
    </>
  );
});

export function PacmanGame({ images, onWin, onExit }: Props) {
  const { width, height } = useWindowDimensions();
  const CELL = Math.floor(Math.min((width - 48) / COLS, (height * 0.44) / ROWS));
  const boardW = CELL * COLS;
  const boardH = CELL * ROWS;

  const [game, setGame] = useState<PacGame>(() => newPacGame(COLS, ROWS));
  const [wonNotified, setWonNotified] = useState(false);
  const dDx = useSharedValue(0); // direction voulue (joystick) — x
  const dDy = useSharedValue(0); // direction voulue (joystick) — y
  const knobX = useSharedValue(0);
  const knobY = useSharedValue(0);

  // Boucle de jeu : un pas toutes les STEP ms tant qu'on joue.
  useEffect(() => {
    if (game.status !== 'playing') return;
    const id = setInterval(() => setGame((g) => tick(g, { dx: dDx.value, dy: dDy.value })), STEP);
    return () => clearInterval(id);
  }, [game.status, dDx, dDy]);

  // Victoire signalée une fois (coupon côté route).
  useEffect(() => {
    if (game.status === 'won' && !wonNotified) {
      setWonNotified(true);
      onWin();
    }
  }, [game.status, wonNotified, onWin]);

  const restart = () => {
    setWonNotified(false);
    dDx.value = 0;
    dDy.value = 0;
    setGame(newPacGame(COLS, ROWS));
  };

  const STICK = Math.min(130, width * 0.34);
  // Mémoïsé : sinon le geste serait reconstruit ~7×/s (à chaque pas de jeu) et le
  // GestureDetector se ré-attacherait → joystick qui « accroche ».
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .onUpdate((e) => {
          'worklet';
          const max = STICK * 0.3;
          let dx = e.translationX;
          let dy = e.translationY;
          const mag = Math.hypot(dx, dy);
          if (mag > max) {
            dx = (dx / mag) * max;
            dy = (dy / mag) * max;
          }
          knobX.value = dx;
          knobY.value = dy;
          if (Math.hypot(e.translationX, e.translationY) > 8) {
            if (Math.abs(e.translationX) > Math.abs(e.translationY)) {
              dDx.value = e.translationX > 0 ? 1 : -1;
              dDy.value = 0;
            } else {
              dDx.value = 0;
              dDy.value = e.translationY > 0 ? 1 : -1;
            }
          }
        })
        .onEnd(() => {
          'worklet';
          knobX.value = withSpring(0);
          knobY.value = withSpring(0);
        }),
    [STICK, dDx, dDy, knobX, knobY],
  );
  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: knobX.value }, { translateY: knobY.value }],
  }));

  const p = game.pac;
  const angle = p.dx === 1 ? 0 : p.dx === -1 ? 180 : p.dy === 1 ? 90 : p.dy === -1 ? 270 : 0;
  const mouthOpen = game.frame % 2 === 0;
  // Réf. stable tant que `game.food` ne change pas (il est figé pour la partie).
  const foodSet = useMemo(() => new Set(game.food), [game.food]);
  // Signature « quelle food est mangée » — 6 caractères, recalcul quasi gratuit.
  const eatenKey = game.food.map((f) => (game.eaten[f] ? '1' : '0')).join('');
  const over = game.status !== 'playing';
  const won = game.status === 'won';

  return (
    <GameShell
      title="PAC"
      accent="FREEDOO"
      subtitle="Croquez tout, évitez les fantômes."
      onBack={onExit}
      scroll={false}
      footer={
        <View className="flex-row items-center justify-between">
          <View className="max-w-[52%]">
            <AppText variant="caption" className="text-ink-inverse/70">
              Tirez le joystick pour diriger. Chaque victoire donne un coupon.
            </AppText>
          </View>
          <GestureDetector gesture={pan}>
            <View
              style={{
                width: STICK,
                height: STICK,
                borderRadius: STICK / 2,
                backgroundColor: 'rgba(246,242,234,0.12)',
                borderWidth: 1,
                borderColor: 'rgba(246,242,234,0.2)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Animated.View
                style={[
                  {
                    width: STICK * 0.44,
                    height: STICK * 0.44,
                    borderRadius: STICK * 0.22,
                    backgroundColor: gameTheme.gold,
                  },
                  knobStyle,
                ]}
              />
            </View>
          </GestureDetector>
        </View>
      }
    >
      {/* HUD */}
      <View className="mb-3 flex-row items-center justify-center gap-3">
        <View className="flex-row items-center gap-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <Feather
              key={i}
              name="circle"
              size={14}
              color={i < game.lives ? gameTheme.gold : 'rgba(246,242,234,0.3)'}
            />
          ))}
        </View>
        <View className="rounded-pill bg-ink-inverse/15 px-3 py-1">
          <AppText className="font-display text-ink-inverse" style={{ fontSize: 13 }}>
            🍽️ {game.dotsLeft}
          </AppText>
        </View>
      </View>

      {/* Plateau */}
      <View
        className="self-center overflow-hidden rounded-card"
        style={{ width: boardW, height: boardH, backgroundColor: 'rgba(0,0,0,0.18)' }}
      >
        <WallsLayer walls={game.walls} cell={CELL} />

        {/* pastilles — un seul SVG */}
        <DotsLayer eaten={game.eaten} foodSet={foodSet} cell={CELL} />

        {/* food = photos des offres (mémoïsé) */}
        <FoodLayer food={game.food} images={images} eatenKey={eatenKey} cell={CELL} />

        {/* fantômes */}
        {game.ghosts.map((g, k) => (
          <Mover key={k} col={g.c} row={g.r} cell={CELL}>
            <GhostSprite cell={CELL} color={GHOST_COLORS[k % GHOST_COLORS.length]!} />
          </Mover>
        ))}

        {/* perso */}
        <Mover col={p.c} row={p.r} cell={CELL}>
          <PacSprite cell={CELL} angle={angle} open={mouthOpen} />
        </Mover>
      </View>

      {/* Fin de partie */}
      {over ? (
        <View
          testID="pacman-result"
          className="mt-4 items-center gap-3 self-center rounded-card bg-ink-inverse p-6"
          style={{ width: boardW }}
        >
          <View
            className="h-14 w-14 items-center justify-center rounded-pill"
            style={{ backgroundColor: won ? colors.brand50 : colors.surfaceSunken }}
          >
            <Feather
              name={won ? 'gift' : 'refresh-ccw'}
              size={26}
              color={won ? colors.brand500 : colors.inkMuted}
            />
          </View>
          <AppText variant="title" className="text-center text-xl">
            {won ? 'Gagné ! Coupon débloqué 🎉' : 'Attrapé — on retente ?'}
          </AppText>
          <View className="mt-1 w-full gap-2">
            <Pressable
              testID="pacman-restart"
              accessibilityRole="button"
              onPress={restart}
              className="items-center rounded-control bg-brand-500 py-3.5 active:bg-brand-600"
            >
              <AppText className="font-sans-bold text-ink-inverse">
                {won ? 'Rejouer' : 'Nouvelle partie'}
              </AppText>
            </Pressable>
            <Pressable
              testID="pacman-exit"
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
