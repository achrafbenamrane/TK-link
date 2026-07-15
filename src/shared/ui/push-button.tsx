import { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from './text';

type FeatherName = ComponentProps<typeof Feather>['name'];

export type PushButtonProps = {
  onPress: () => void;
  /** Small top line (e.g. "OBTENIR"). Omitted when absent. */
  label?: string;
  /** Big bottom line, set in the display font (e.g. "AJOUTER"). Omitted when absent. */
  sublabel?: string;
  icon?: FeatherName;
  /** Cap diameter. Everything else scales from this. */
  size?: number;
  testID?: string;
  accessibilityLabel?: string;
};

const CAP = '#F5311D';
const BASE = '#8a0d18';

/** Ratios taken from the 178px landing-page button, so any size keeps its look. */
const WALL_RATIO = 0.084; // 3D thickness — how far the cap sinks
const ICON_RATIO = 0.2;
const LABEL_RATIO = 0.067;
const SUBLABEL_RATIO = 0.125;

/**
 * Freedoo's signature red 3D push button — a solid cap raised on a darker base
 * that physically compresses on press. Reanimated, reduced-motion aware.
 * Reused from the landing page at the client's request.
 *
 * Sizes proportionally: at 178 it is the landing-page hero button, at ~80 it is
 * the add-to-cart control inside a product card.
 */
export function PushButton({
  onPress,
  label,
  sublabel,
  icon = 'arrow-down',
  size = 178,
  testID,
  accessibilityLabel,
}: PushButtonProps) {
  const pressed = useSharedValue(0);
  const reduced = useReducedMotion();

  const wall = Math.max(4, Math.round(size * WALL_RATIO));
  const iconSize = Math.max(12, Math.round(size * ICON_RATIO));
  const labelSize = Math.max(8, Math.round(size * LABEL_RATIO));
  const sublabelSize = Math.max(9, Math.round(size * SUBLABEL_RATIO));

  const capStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pressed.value * wall }],
  }));

  const down = () => {
    pressed.value = reduced ? 1 : withTiming(1, { duration: 90 });
  };
  const up = () => {
    pressed.value = reduced ? 0 : withTiming(0, { duration: 150 });
  };

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? [label, sublabel].filter(Boolean).join(' ')}
      onPressIn={down}
      onPressOut={up}
      onPress={onPress}
      style={{ width: size, height: size + wall }}
    >
      {/* base / socket */}
      <View
        style={{
          position: 'absolute',
          top: wall,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: BASE,
          shadowColor: BASE,
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.45,
          shadowRadius: 16,
          elevation: 6,
        }}
      />
      {/* cap */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: CAP,
            alignItems: 'center',
            justifyContent: 'center',
          },
          capStyle,
        ]}
      >
        <View style={{ alignItems: 'center', gap: size < 100 ? 1 : 3 }}>
          <Feather name={icon} size={iconSize} color="#ffffff" />
          {label ? (
            <AppText
              className="font-sans-bold"
              style={{ color: '#ffffff', fontSize: labelSize, letterSpacing: 1.6 }}
            >
              {label}
            </AppText>
          ) : null}
          {sublabel ? (
            <AppText
              numberOfLines={1}
              className="font-display"
              style={{ color: '#ffffff', fontSize: sublabelSize }}
            >
              {sublabel}
            </AppText>
          ) : null}
        </View>
      </Animated.View>
    </Pressable>
  );
}
