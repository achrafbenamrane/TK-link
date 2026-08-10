import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { AppText } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { TkMark } from '../tk-mark';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Durée d'un tour complet : traversée, bouchée, récompense. */
const CYCLE = 4200;
const PELLETS = 4;
/** Fraction du cycle où PacTK atteint la marque. */
const REACH = 0.74;

/**
 * Le disque de PacTK, bouche ouverte de `angle` degrés de part et d'autre.
 *
 * Deux points sur le cercle, puis le grand arc qui les relie par l'autre côté :
 * c'est la forme entière moins le coin de bouche. Reconstruire le tracé à
 * chaque image se fait sur le thread UI (`worklet`), donc sans passer par JS.
 */
function mouth(angleDeg: number, r: number): string {
  'worklet';
  const a = (angleDeg * Math.PI) / 180;
  const x1 = r + r * Math.cos(a);
  const y1 = r - r * Math.sin(a);
  const x2 = x1;
  const y2 = r + r * Math.sin(a);
  return `M${r},${r} L${x1},${y1} A${r},${r} 0 1 0 ${x2},${y2} Z`;
}

function Pac({ size, chomp }: { size: number; chomp: SharedValue<number> }) {
  const r = size / 2;
  const props = useAnimatedProps(() => ({ d: mouth(chomp.value, r) }));

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <AnimatedPath animatedProps={props} fill={colors.lime} />
    </Svg>
  );
}

/**
 * PacTK CROQUE LA MARQUE.
 *
 * Les jeux sont ce qui distingue TK LINK d'un catalogue de promotions : il
 * fallait le montrer, pas l'écrire. Le trajet raconte toute la boucle du
 * produit en un plan — on avale les pastilles, on croque la marque, un coupon
 * tombe.
 *
 * @param still Fige la scène au premier instant : mode « réduire les
 * animations », où une boucle serait exactement ce qu'on ne veut pas.
 */
export function PacmanScene({ size = 300, still = false }: { size?: number; still?: boolean }) {
  const progress = useSharedValue(0);
  const chomp = useSharedValue(34);

  const pac = size * 0.17;
  const lane = size * 0.86;
  const travel = lane - pac;

  useEffect(() => {
    if (still) return;
    progress.value = withRepeat(
      withTiming(1, { duration: CYCLE, easing: Easing.linear }),
      -1,
      false,
    );
    chomp.value = withRepeat(withTiming(4, { duration: 190, easing: Easing.linear }), -1, true);
  }, [still, progress, chomp]);

  const pacStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(progress.value, [0, REACH], [0, travel], 'clamp') },
      // Petit à-coup au moment de la bouchée : le corps encaisse.
      {
        scale:
          1 +
          interpolate(progress.value, [REACH, REACH + 0.05, REACH + 0.1], [0, 0.14, 0], 'clamp'),
      },
    ],
  }));

  const markStyle = useAnimatedStyle(() => {
    const p = interpolate(progress.value, [REACH, REACH + 0.09], [1, 0], 'clamp');
    return {
      opacity: p,
      transform: [{ scale: 0.4 + p * 0.6 }, { translateX: (1 - p) * -size * 0.06 }],
    };
  });

  const rewardStyle = useAnimatedStyle(() => {
    const p = interpolate(progress.value, [REACH + 0.06, REACH + 0.16, 0.98], [0, 1, 1], 'clamp');
    return { opacity: p, transform: [{ translateY: (1 - p) * 14 }, { scale: 0.8 + p * 0.2 }] };
  });

  return (
    <View
      testID="welcome-pacman"
      accessible
      accessibilityRole="image"
      accessibilityLabel="PacTK croque la marque TK LINK et gagne un coupon"
      style={{ width: size, height: size }}
      className="items-center justify-center"
    >
      {/* La piste */}
      <View style={{ width: lane, height: pac * 1.6 }} className="justify-center">
        {/* Les pastilles à avaler — chacune disparaît quand PacTK la dépasse. */}
        {Array.from({ length: PELLETS }, (_, i) => {
          const at = (i + 1) / (PELLETS + 1);
          const dot = size * 0.035;
          return (
            <Pellet
              key={i}
              progress={progress}
              still={still}
              left={at * travel + pac * 0.9}
              top={(pac * 1.6 - dot) / 2}
              size={dot}
              eatenAt={at * REACH}
            />
          );
        })}

        <Animated.View
          style={[{ position: 'absolute', left: 0, top: (pac * 1.6 - pac) / 2 }, pacStyle]}
        >
          <Pac size={pac} chomp={chomp} />
        </Animated.View>
      </View>

      {/* La marque, au bout de la piste */}
      <Animated.View style={[{ marginTop: size * 0.06 }, markStyle]}>
        <TkMark size={size * 0.15} />
      </Animated.View>

      {/* Ce que la bouchée rapporte */}
      <Animated.View
        style={[{ marginTop: size * 0.07 }, rewardStyle]}
        className="flex-row items-center gap-1.5 rounded-pill bg-lime px-3 py-1.5"
      >
        <AppText className="font-sans-bold text-forest-deep" style={{ fontSize: size * 0.042 }}>
          + 1 coupon
        </AppText>
      </Animated.View>
    </View>
  );
}

/** Une pastille : présente, puis avalée au passage de PacTK. */
function Pellet({
  progress,
  still,
  left,
  top,
  size,
  eatenAt,
}: {
  progress: SharedValue<number>;
  still: boolean;
  left: number;
  top: number;
  size: number;
  eatenAt: number;
}) {
  const style = useAnimatedStyle(() => {
    if (still) return { opacity: 1, transform: [{ scale: 1 }] };
    const p = interpolate(progress.value, [eatenAt - 0.03, eatenAt], [1, 0], 'clamp');
    return { opacity: p, transform: [{ scale: 0.4 + p * 0.6 }] };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left,
          top,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.limeSoft,
        },
        style,
      ]}
    />
  );
}
