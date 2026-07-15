import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { AppText } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

export type ScanState = 'repos' | 'scan' | 'ok' | 'echec';

type Props = {
  state: ScanState;
  onPress: () => void;
  size?: number;
  testID?: string;
};

const RIPPLES = [0, 1, 2];

/**
 * Une onde. Composant à part parce qu'un hook ne peut pas vivre dans un .map() —
 * `useAnimatedStyle` doit être appelé au niveau racine d'un composant.
 */
function Ripple({
  index,
  pulse,
  active,
  size,
}: {
  index: number;
  pulse: SharedValue<number>;
  active: boolean;
  size: number;
}) {
  const style = useAnimatedStyle(() => {
    const p = (pulse.value + index / RIPPLES.length) % 1;
    return {
      opacity: active ? interpolate(p, [0, 0.6, 1], [0.35, 0.12, 0]) : 0,
      transform: [{ scale: interpolate(p, [0, 1], [0.85, 1.6]) }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: size * 1.5,
          height: size * 1.5,
          borderRadius: size,
          borderWidth: 2,
          borderColor: colors.brand500,
        },
        style,
      ]}
    />
  );
}

/**
 * Scanner d'empreinte façon iOS : le glyphe se remplit de bas en haut pendant
 * la lecture, avec des ondes concentriques.
 *
 * L'animation est la nôtre ; la vérification, elle, appartient à l'OS (voir
 * `lib/biometrics.ts`). Rien ici ne lit une empreinte — c'est impossible — donc
 * on ne mime jamais une « capture » : on accompagne l'invite système.
 */
export function FingerprintScanner({ state, onPress, size = 132, testID }: Props) {
  const fill = useSharedValue(0); // 0 → 1 : hauteur révélée du glyphe rouge
  const pulse = useSharedValue(0); // ondes concentriques
  const shake = useSharedValue(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (state === 'scan') {
      // Remplissage progressif + ondes, en boucle tant que l'OS interroge.
      fill.value = reduced ? 1 : withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) });
      pulse.value = reduced
        ? 0
        : withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false);
      return;
    }

    cancelAnimation(pulse);
    pulse.value = 0;

    if (state === 'ok') {
      fill.value = withTiming(1, { duration: 180 });
      return;
    }
    if (state === 'echec') {
      fill.value = withTiming(0, { duration: 220 });
      shake.value = reduced
        ? 0
        : withSequence(
            withTiming(-1, { duration: 55 }),
            withRepeat(withTiming(1, { duration: 110 }), 3, true),
            withTiming(0, { duration: 55 }),
          );
      return;
    }
    fill.value = withTiming(0, { duration: 300 });
  }, [state, fill, pulse, shake, reduced]);

  // Le glyphe coloré est révélé de bas en haut : on anime la hauteur du masque.
  const revealStyle = useAnimatedStyle(() => ({
    height: size * fill.value,
  }));

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value * 7 }],
  }));

  const tint =
    state === 'ok' ? colors.success : state === 'echec' ? colors.brand600 : colors.brand500;

  return (
    <Animated.View style={shakeStyle} className="items-center">
      <View
        style={{ width: size * 1.7, height: size * 1.7 }}
        className="items-center justify-center"
      >
        {RIPPLES.map((i) => (
          <Ripple key={i} index={i} pulse={pulse} active={state === 'scan'} size={size} />
        ))}

        <Pressable
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel="Scanner mon empreinte"
          accessibilityState={{ busy: state === 'scan' }}
          onPress={onPress}
          className="items-center justify-center rounded-pill border border-line bg-surface-muted"
          style={{ width: size * 1.22, height: size * 1.22 }}
        >
          {/* glyphe au repos */}
          <Ionicons name="finger-print" size={size} color={colors.inkFaint} />

          {/* glyphe coloré, révélé de bas en haut */}
          <Animated.View
            pointerEvents="none"
            style={[
              { position: 'absolute', bottom: (size * 1.22 - size) / 2, overflow: 'hidden' },
              revealStyle,
            ]}
          >
            <View style={{ height: size, justifyContent: 'flex-end' }}>
              {state === 'ok' ? (
                <Ionicons name="checkmark-circle" size={size} color={tint} />
              ) : (
                <Ionicons name="finger-print" size={size} color={tint} />
              )}
            </View>
          </Animated.View>
        </Pressable>
      </View>

      <AppText variant="caption" className="mt-3 text-center text-ink-faint">
        {state === 'scan'
          ? 'Lecture en cours…'
          : state === 'ok'
            ? 'Identifié'
            : state === 'echec'
              ? 'Non reconnu — réessayez'
              : 'Touchez pour tester'}
      </AppText>
    </Animated.View>
  );
}
