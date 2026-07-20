import { useEffect } from 'react';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/shared/ui';

const INK = '#17140F';
const CREAM = '#F6F2EA';
const RED = '#F5311D';

type Props = {
  /** Côté du sac en px. Tout le reste en dérive. */
  size?: number;
  /** Appelé quand l'intro s'est posée — l'écran révèle alors le texte. */
  onSettled?: () => void;
  /**
   * `onLight` = sac ink sur fond clair (comme l'icône). `onDark` = sac crème sur
   * fond sombre. Un sac ink sur fond ink serait invisible : le variant n'est pas
   * optionnel selon le fond.
   */
  variant?: 'onLight' | 'onDark';
};

/**
 * Le sac Freedoo qui S'ASSEMBLE : l'anse se déplie, le corps surgit avec un
 * ressort, le F éclot, puis le point rouge pulse. Chaque part est animée
 * séparément — c'est le montage pièce par pièce qui donne l'effet « premium »,
 * qu'un simple fondu de l'image entière ne rend pas.
 *
 * 100 % Reanimated (thread UI, 60 fps), et conscient de « réduire les
 * animations » : dans ce mode on montre l'état final sans chorégraphie.
 */
export function AnimatedLogo({ size = 132, onSettled, variant = 'onLight' }: Props) {
  const reduced = useReducedMotion();

  const bag = variant === 'onDark' ? CREAM : INK;
  const glyph = variant === 'onDark' ? INK : CREAM;

  const bagW = size;
  const bagH = size * 1.15;
  const handleW = bagW * 0.52;
  const handleH = bagW * 0.3;
  const stroke = Math.max(4, size * 0.05);

  const handle = useSharedValue(reduced ? 1 : 0);
  const body = useSharedValue(reduced ? 1 : 0);
  const letter = useSharedValue(reduced ? 1 : 0);
  const dot = useSharedValue(reduced ? 1 : 0);
  const float = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      onSettled?.();
      return;
    }
    // L'anse se déplie du haut…
    handle.value = withDelay(
      150,
      withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }),
    );
    // …le corps surgit avec un léger dépassement…
    body.value = withDelay(320, withSpring(1, { damping: 11, stiffness: 140, mass: 0.9 }));
    // …le F éclot…
    letter.value = withDelay(620, withSpring(1, { damping: 9, stiffness: 170 }));
    // …le point rouge apparaît et signale que c'est prêt.
    dot.value = withDelay(
      900,
      withTiming(1, { duration: 260 }, (done) => {
        if (done && onSettled) runOnJS(onSettled)();
      }),
    );
    // Respiration continue, une fois posé.
    float.value = withDelay(
      1100,
      withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true),
    );
  }, [reduced, handle, body, letter, dot, float, onSettled]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -float.value * 6 }],
  }));

  const handleStyle = useAnimatedStyle(() => ({
    opacity: handle.value,
    // se déplie vers le bas depuis son ancrage
    transform: [
      { translateY: (1 - handle.value) * -handleH * 0.4 },
      { scaleY: 0.6 + handle.value * 0.4 },
    ],
  }));

  const bodyStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, body.value * 1.4),
    transform: [{ scale: 0.4 + body.value * 0.6 }],
  }));

  const letterStyle = useAnimatedStyle(() => ({
    opacity: letter.value,
    transform: [{ scale: 0.3 + letter.value * 0.7 }],
  }));

  const dotStyle = useAnimatedStyle(() => ({
    opacity: dot.value,
    transform: [{ scale: dot.value }],
  }));

  return (
    <Animated.View
      style={[{ width: bagW, height: bagH + handleH * 0.55, alignItems: 'center' }, containerStyle]}
    >
      {/* Anse : une arche « ∩ », ancrée dans le haut du corps. */}
      <Animated.View
        style={[
          {
            width: handleW,
            height: handleH,
            borderWidth: stroke,
            borderColor: bag,
            borderTopLeftRadius: handleW,
            borderTopRightRadius: handleW,
            borderBottomWidth: 0,
          },
          handleStyle,
        ]}
      />

      {/* Corps du sac + F. */}
      <Animated.View
        style={[
          {
            width: bagW,
            height: bagH,
            marginTop: -stroke,
            borderRadius: bagW * 0.16,
            backgroundColor: bag,
            alignItems: 'center',
            justifyContent: 'center',
          },
          bodyStyle,
        ]}
      >
        <Animated.View style={letterStyle}>
          <AppText
            className="font-display"
            style={{ color: glyph, fontSize: size * 0.5, lineHeight: size * 0.62 }}
          >
            F
          </AppText>
        </Animated.View>
      </Animated.View>

      {/* Point rouge : la signature « Freedoo. », posée en bas à droite. */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            right: bagW * 0.04,
            bottom: 0,
            width: size * 0.16,
            height: size * 0.16,
            borderRadius: size * 0.16,
            backgroundColor: RED,
          },
          dotStyle,
        ]}
      />
    </Animated.View>
  );
}
