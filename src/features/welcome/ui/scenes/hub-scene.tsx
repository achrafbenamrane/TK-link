import { Feather } from '@expo/vector-icons';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { AppText } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { TkTree } from '../tk-mark';

/** Un tour : l'XP monte, le niveau saute, le coffre s'ouvre. */
const CYCLE = 5200;

type Props = { size?: number; still?: boolean };

/**
 * LA CHASSE, résumée en un plan : la barre d'XP se remplit, le rang passe au
 * niveau suivant, le coffre s'ouvre, les trophées tombent.
 *
 * C'est la promesse la plus difficile à écrire en une phrase — « une app qui
 * récompense » ne veut rien dire tant qu'on n'a pas vu la barre bouger. D'où
 * une scène plutôt qu'un paragraphe.
 */
export function HubScene({ size = 300, still = false }: Props) {
  const progress = useSharedValue(still ? 1 : 0);

  useEffect(() => {
    if (still) return;
    progress.value = withRepeat(
      withTiming(1, { duration: CYCLE, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [still, progress]);

  const bar = useAnimatedStyle(() => ({
    width: `${interpolate(progress.value, [0, 0.62], [12, 100], 'clamp')}%`,
  }));

  const level = useAnimatedStyle(() => {
    // Le palier saute quand la barre arrive au bout : c'est LE moment de la boucle.
    const pop = interpolate(progress.value, [0.58, 0.66, 0.74], [0, 1, 0], 'clamp');
    return { transform: [{ scale: 1 + pop * 0.22 }] };
  });

  const chest = useAnimatedStyle(() => {
    const p = interpolate(progress.value, [0.62, 0.78], [0, 1], 'clamp');
    return {
      opacity: 0.35 + p * 0.65,
      transform: [{ scale: 0.9 + p * 0.1 }, { rotate: `${(1 - p) * -8}deg` }],
    };
  });

  return (
    <View
      testID="welcome-hub"
      accessible
      accessibilityRole="image"
      accessibilityLabel="La progression : XP, niveau, coffre du jour et trophées"
      style={{ width: size, height: size }}
      className="items-center justify-center"
    >
      <View
        className="overflow-hidden rounded-card bg-forest"
        style={{ width: size * 0.86, padding: size * 0.05 }}
      >
        {/* Rang + série */}
        <View className="flex-row items-center" style={{ gap: size * 0.035 }}>
          <Animated.View
            style={[
              level,
              {
                width: size * 0.13,
                height: size * 0.13,
                borderRadius: size * 0.065,
                backgroundColor: colors.lime,
              },
            ]}
            className="items-center justify-center"
          >
            <LevelNumber progress={progress} size={size} />
          </Animated.View>
          <View className="flex-1">
            <AppText
              className="font-display text-ink-inverse"
              style={{ fontSize: size * 0.055, lineHeight: size * 0.075 }}
            >
              Chasseur
            </AppText>
            <AppText className="text-ink-inverse/60" style={{ fontSize: size * 0.038 }}>
              Chaque geste rapporte
            </AppText>
          </View>
          <View
            className="flex-row items-center rounded-pill bg-brand-500"
            style={{ gap: 4, paddingHorizontal: size * 0.028, paddingVertical: size * 0.014 }}
          >
            <Feather name="zap" size={size * 0.04} color={colors.inkInverse} />
            <AppText className="font-sans-bold text-ink-inverse" style={{ fontSize: size * 0.038 }}>
              7 j
            </AppText>
          </View>
        </View>

        {/* La barre d'XP qui se remplit */}
        <View
          className="overflow-hidden rounded-pill bg-ink-inverse/15"
          style={{ height: size * 0.022, marginTop: size * 0.045 }}
        >
          <Animated.View style={[bar, { height: '100%', backgroundColor: colors.lime }]} />
        </View>

        {/* Le coffre du jour */}
        <Animated.View
          style={[
            chest,
            { marginTop: size * 0.045, padding: size * 0.035, borderRadius: size * 0.05 },
          ]}
          className="flex-row items-center bg-forest-deep"
        >
          <View
            className="items-center justify-center rounded-control bg-lime"
            style={{ width: size * 0.11, height: size * 0.11 }}
          >
            <Feather name="gift" size={size * 0.055} color={colors.forestDeep} />
          </View>
          <View style={{ marginLeft: size * 0.035 }}>
            <AppText className="font-sans-bold text-ink-inverse" style={{ fontSize: size * 0.042 }}>
              Coffre du jour
            </AppText>
            <AppText className="text-lime" style={{ fontSize: size * 0.036 }}>
              + 60 points
            </AppText>
          </View>
        </Animated.View>

        {/* Les trophées tombent un à un */}
        <View className="flex-row" style={{ gap: size * 0.025, marginTop: size * 0.04 }}>
          {(['award', 'target', 'star'] as const).map((icon, i) => (
            <Badge key={icon} icon={icon} index={i} progress={progress} size={size} />
          ))}
          <View className="flex-1 items-end justify-end">
            <TkTree size={size * 0.12} />
          </View>
        </View>
      </View>
    </View>
  );
}

/** Le numéro de rang : 4 avant le palier, 5 après. */
function LevelNumber({ progress, size }: { progress: SharedValue<number>; size: number }) {
  const four = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.6, 0.64], [1, 0], 'clamp'),
  }));
  const five = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.62, 0.66], [0, 1], 'clamp'),
  }));
  const style = { position: 'absolute' as const };
  const text = { fontSize: size * 0.06, lineHeight: size * 0.085 };

  return (
    <>
      <Animated.View style={[style, four]}>
        <AppText className="font-display text-forest" style={text}>
          4
        </AppText>
      </Animated.View>
      <Animated.View style={[style, five]}>
        <AppText className="font-display text-forest" style={text}>
          5
        </AppText>
      </Animated.View>
    </>
  );
}

function Badge({
  icon,
  index,
  progress,
  size,
}: {
  icon: 'award' | 'target' | 'star';
  index: number;
  progress: SharedValue<number>;
  size: number;
}) {
  const style = useAnimatedStyle(() => {
    const from = 0.68 + index * 0.06;
    const p = interpolate(progress.value, [from, from + 0.08], [0, 1], 'clamp');
    return { opacity: p, transform: [{ scale: 0.6 + p * 0.4 }, { translateY: (1 - p) * 10 }] };
  });

  return (
    <Animated.View
      style={[
        style,
        {
          width: size * 0.085,
          height: size * 0.085,
          borderRadius: size * 0.0425,
          backgroundColor: 'rgba(242,247,240,0.12)',
        },
      ]}
      className="items-center justify-center"
    >
      <Feather name={icon} size={size * 0.042} color={colors.lime} />
    </Animated.View>
  );
}
