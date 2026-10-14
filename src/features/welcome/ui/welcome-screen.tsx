import { Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AppText, Wordmark } from '@/shared/ui';
import { ThemeScope, useColors } from '@/shared/theme/theme-provider';

import { useWelcomeStore } from '../model/store';

/** Durée de l'animation avant de passer à la suite, en ms. */
export const SPLASH_MS = 2300;

/**
 * Le temps que l'éclair a d'avance sur le logo, en ms. Le client veut que « l'éclair arrive plus vite
 * que le texte TK-Link, comme la lumière » : l'éclair frappe d'abord, le logo se révèle derrière lui.
 */
export const BOLT_LEAD_MS = 320;

type Props = {
  /**
   * Appelé quand l'animation est finie — la route décide où aller : le choix du profil
   * au premier lancement, l'accueil quand le compte existe déjà.
   */
  onDone: () => void;
};

/**
 * L'OUVERTURE — le logo TKlink qui s'anime, puis l'app passe d'elle-même à la suite.
 *
 * Un éclair rose frappe d'abord (rapide, il s'éteint aussitôt), puis le logo entre derrière lui
 * (fondu + ressort), un halo rose pulse, la signature « Le bon plan, partout. » apparaît dessous. Aucun bouton : l'écran ne demande rien, il
 * présente la marque le temps que l'app se charge. Avec « réduire les animations »,
 * le logo est posé tel quel.
 */
/** L'éclair : une icône dans le thème de l'écran (il vit sous `ThemeScope`, d'où le composant à part). */
function BoltIcon() {
  const colors = useColors();
  return <Feather name="zap" size={150} color={colors.brand500} />;
}

export function WelcomeScreen({ onDone }: Props) {
  const reduced = useReducedMotion();
  const markSeen = useWelcomeStore((s) => s.markSeen);

  const logoOpacity = useSharedValue(reduced ? 1 : 0);
  const logoScale = useSharedValue(reduced ? 1 : 0.72);
  const glow = useSharedValue(reduced ? 0.6 : 0);
  const tagOpacity = useSharedValue(reduced ? 1 : 0);
  // L'éclair : un coup bref qui s'allume en un instant puis retombe. Absent avec « réduire les animations ».
  const bolt = useSharedValue(0);

  useEffect(() => {
    markSeen();
    if (!reduced) {
      bolt.value = withSequence(
        withTiming(1, { duration: 90, easing: Easing.out(Easing.quad) }),
        withTiming(0.55, { duration: 70 }),
        withTiming(1, { duration: 60 }),
        withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) }),
      );
      // Le logo n'apparaît qu'après l'éclair : la lumière précède le texte.
      logoOpacity.value = withDelay(
        BOLT_LEAD_MS,
        withTiming(1, { duration: 550, easing: Easing.out(Easing.cubic) }),
      );
      logoScale.value = withDelay(BOLT_LEAD_MS, withSpring(1, { damping: 11, stiffness: 120 }));
      glow.value = withRepeat(
        withSequence(withTiming(1, { duration: 900 }), withTiming(0.35, { duration: 900 })),
        -1,
      );
      tagOpacity.value = withDelay(900 + BOLT_LEAD_MS, withTiming(1, { duration: 600 }));
    }
    const timer = setTimeout(onDone, reduced ? 900 : SPLASH_MS);
    return () => clearTimeout(timer);
    // L'animation ne se rejoue pas : une seule passe au montage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value * 0.55,
    transform: [{ scale: 0.9 + glow.value * 0.25 }],
  }));
  const tagStyle = useAnimatedStyle(() => ({ opacity: tagOpacity.value }));
  const boltStyle = useAnimatedStyle(() => ({
    opacity: bolt.value,
    transform: [{ scale: 0.6 + bolt.value * 0.7 }],
  }));

  return (
    <ThemeScope scheme="night">
      <View testID="welcome-screen" className="flex-1 items-center justify-center bg-surface">
        <StatusBar style="light" />

        {/* Le halo rose derrière le logo */}
        <Animated.View
          pointerEvents="none"
          className="absolute h-72 w-72 rounded-pill bg-brand-500"
          style={glowStyle}
        />

        <Animated.View
          testID="welcome-bolt"
          pointerEvents="none"
          style={boltStyle}
          className="absolute"
        >
          <BoltIcon />
        </Animated.View>

        <Animated.View testID="welcome-logo" style={logoStyle}>
          <Wordmark size={64} />
        </Animated.View>

        <Animated.View style={tagStyle} className="mt-5">
          <AppText className="text-ink-muted" style={{ fontSize: 15, letterSpacing: 0.4 }}>
            Le bon plan, partout.
          </AppText>
        </Animated.View>
      </View>
    </ThemeScope>
  );
}
