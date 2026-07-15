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
  /** Small top line (e.g. "OBTENIR"). */
  label?: string;
  /** Big bottom line, set in the display font (e.g. "L’APP"). */
  sublabel?: string;
  icon?: FeatherName;
  size?: number;
  testID?: string;
  accessibilityLabel?: string;
};

const WALL = 15; // 3D thickness (px the cap sinks on press)
const CAP = '#F5311D';
const BASE = '#8a0d18';

/**
 * Freedoo's signature red 3D push button — a solid cap raised on a darker base
 * that physically compresses on press. Reanimated, reduced-motion aware.
 * Reused from the landing page at the client's request.
 */
export function PushButton({
  onPress,
  label = 'OBTENIR',
  sublabel = 'L’APP',
  icon = 'arrow-down',
  size = 178,
  testID,
  accessibilityLabel,
}: PushButtonProps) {
  const pressed = useSharedValue(0);
  const reduced = useReducedMotion();

  const capStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pressed.value * WALL }],
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
      accessibilityLabel={accessibilityLabel ?? `${label} ${sublabel}`}
      onPressIn={down}
      onPressOut={up}
      onPress={onPress}
      style={{ width: size, height: size + WALL }}
    >
      {/* base / socket */}
      <View
        style={{
          position: 'absolute',
          top: WALL,
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
        <View style={{ alignItems: 'center', gap: 3 }}>
          <Feather name={icon} size={26} color="#ffffff" />
          <AppText
            className="font-sans-bold"
            style={{ color: '#ffffff', fontSize: 12, letterSpacing: 1.6 }}
          >
            {label}
          </AppText>
          <AppText className="font-display" style={{ color: '#ffffff', fontSize: 21 }}>
            {sublabel}
          </AppText>
        </View>
      </Animated.View>
    </Pressable>
  );
}
