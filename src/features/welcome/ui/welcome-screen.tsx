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
import { ThemeScope } from '@/shared/theme/theme-provider';

import { useWelcomeStore } from '../model/store';

/** Durée de l'animation avant de passer à la suite, en ms. */
export const SPLASH_MS = 2300;

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
 * Le logo entre (fondu + ressort), un halo rose pulse derrière, la signature « Le bon
 * plan, partout. » apparaît dessous. Aucun bouton : l'écran ne demande rien, il
 * présente la marque le temps que l'app se charge. Avec « réduire les animations »,
 * le logo est posé tel quel.
 */
export function WelcomeScreen({ onDone }: Props) {
  const reduced = useReducedMotion();
  const markSeen = useWelcomeStore((s) => s.markSeen);

  const logoOpacity = useSharedValue(reduced ? 1 : 0);
  const logoScale = useSharedValue(reduced ? 1 : 0.72);
  const glow = useSharedValue(reduced ? 0.6 : 0);
  const tagOpacity = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    markSeen();
    if (!reduced) {
      logoOpacity.value = withTiming(1, { duration: 550, easing: Easing.out(Easing.cubic) });
      logoScale.value = withSpring(1, { damping: 11, stiffness: 120 });
      glow.value = withRepeat(
        withSequence(withTiming(1, { duration: 900 }), withTiming(0.35, { duration: 900 })),
        -1,
      );
      tagOpacity.value = withDelay(900, withTiming(1, { duration: 600 }));
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

  return (
    <ThemeScope scheme="night">
      <View testID="welcome-screen" className="flex-1 items-center justify-center bg-surface">
        <StatusBar style="light" />

        {/* Le halo rose derrière le logo */}
        <Animated.View
          pointerEvents="none"
          className="absolute h-72 w-72 rounded-pill bg-brand-500"
          style={[glowStyle, { opacity: 0.2 }]}
        />

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
