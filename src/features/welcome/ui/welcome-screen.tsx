import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { AppText } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { useWelcomeStore } from '../model/store';
import { LogoHero } from './logo-hero';

const INK = '#17140F';

const VALUES = [
  {
    icon: 'zap' as const,
    title: 'Ventes flash',
    line: 'Les bons plans du quartier, à saisir vite.',
  },
  {
    icon: 'truck' as const,
    title: 'Livraison offerte',
    line: 'Zéro frais caché. Le prix affiché est le prix payé.',
  },
  {
    icon: 'map-pin' as const,
    title: 'Autour de vous',
    line: 'Vos commerçants de proximité, sur une carte.',
  },
];

/**
 * Premier écran de l'app : le sac s'assemble, puis le texte et l'appel à
 * l'action se révèlent une fois l'intro posée (`onSettled`). Fond ink, dans la
 * continuité de l'écran de démarrage natif — l'entrée dans l'app (fond crème)
 * se lit alors comme un « pas à l'intérieur » du produit.
 */
export function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const markSeen = useWelcomeStore((s) => s.markSeen);
  const [revealed, setRevealed] = useState(false);

  const enter = () => {
    markSeen();
    router.replace('/');
  };

  const signIn = () => {
    markSeen();
    router.replace('/sign-in');
  };

  return (
    <View className="flex-1" style={{ backgroundColor: INK, paddingTop: insets.top }}>
      {/* Fond ink → icônes de statut claires, sinon elles disparaissent. */}
      <StatusBar style="light" />
      <View className="flex-1 items-center justify-center px-8">
        <LogoHero onSettled={() => setRevealed(true)} />

        {revealed ? (
          <Animated.View entering={FadeInDown.duration(500)} className="mt-10 items-center">
            <AppText
              className="font-display text-ink-inverse"
              style={{ fontSize: 40, lineHeight: 50 }}
            >
              Freedoo<AppText style={{ color: colors.brand500 }}>.</AppText>
            </AppText>
            <AppText className="mt-2 text-center text-ink-inverse/70" style={{ fontSize: 16 }}>
              Les ventes flash de votre quartier,{'\n'}livrées avant qu’elles ne s’envolent.
            </AppText>
          </Animated.View>
        ) : null}
      </View>

      {revealed ? (
        <Animated.View
          entering={FadeIn.delay(300).duration(500)}
          className="gap-5 px-8"
          style={{ paddingBottom: insets.bottom + 24 }}
        >
          <View className="gap-4">
            {VALUES.map((v, i) => (
              <Animated.View
                key={v.title}
                entering={FadeInDown.delay(400 + i * 120).duration(450)}
                className="flex-row items-center gap-4"
              >
                <View className="h-11 w-11 items-center justify-center rounded-control bg-ink-inverse/10">
                  <Feather name={v.icon} size={19} color={colors.brand500} />
                </View>
                <View className="flex-1">
                  <AppText className="font-sans-bold text-ink-inverse">{v.title}</AppText>
                  <AppText variant="caption" className="text-ink-inverse/60">
                    {v.line}
                  </AppText>
                </View>
              </Animated.View>
            ))}
          </View>

          <Animated.View entering={FadeInDown.delay(760).duration(450)} className="gap-2">
            <Pressable
              testID="welcome-start"
              accessibilityRole="button"
              onPress={enter}
              className="flex-row items-center justify-center gap-2 rounded-control bg-brand-500 py-4 active:bg-brand-600"
            >
              <AppText className="font-sans-bold text-ink-inverse" style={{ fontSize: 16 }}>
                Commencer
              </AppText>
              <Feather name="arrow-right" size={18} color={colors.inkInverse} />
            </Pressable>
            <Pressable
              testID="welcome-signin"
              accessibilityRole="button"
              onPress={signIn}
              className="py-3"
            >
              <AppText className="text-center text-ink-inverse/60">
                J’ai déjà un compte{' '}
                <AppText className="font-sans-bold text-ink-inverse">Se connecter</AppText>
              </AppText>
            </Pressable>
          </Animated.View>
        </Animated.View>
      ) : null}
    </View>
  );
}
