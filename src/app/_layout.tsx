import '../global.css';

import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from '@expo-google-fonts/manrope';
import { Unbounded_700Bold, Unbounded_800ExtraBold } from '@expo-google-fonts/unbounded';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { selectCompleted, selectHydrated, useOnboardingStore } from '@/features/onboarding';
import '@/shared/lib/env'; // fail fast on invalid environment (has safe defaults)
import { colors } from '@/shared/theme/colors';

/**
 * Au premier lancement, on passe par l'onboarding : c'est là qu'on explique la
 * promesse (le ticket papier disparaît) et qu'on personnalise l'app.
 *
 * On attend `hydrated` (lecture du disque terminée) avant de décider, sinon un
 * utilisateur qui revient verrait l'onboarding clignoter le temps que le
 * stockage se charge — `completed` valant `false` par défaut.
 */
function OnboardingGate() {
  const router = useRouter();
  const segments = useSegments();
  const completed = useOnboardingStore(selectCompleted);
  const hydrated = useOnboardingStore(selectHydrated);

  useEffect(() => {
    if (!hydrated || completed) return;
    if (segments[0] !== 'onboarding') router.replace('/onboarding');
  }, [hydrated, completed, segments, router]);

  return null;
}

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Unbounded_700Bold,
    Unbounded_800ExtraBold,
  });

  // NOTE (demo): the auth route-guard + Supabase session are intentionally
  // disabled here so the client preview boots straight into the app. Re-enable
  // useProtectedRoute()/useAuthStore().init() from '@/features/auth' for prod.

  const onboardingHydrated = useOnboardingStore(selectHydrated);

  // On garde l'écran de démarrage natif jusqu'à ce que la police ET la décision
  // « onboarding déjà fait ? » soient prêtes : la porte redirige alors avant le
  // premier rendu visible, donc pas de clignotement.
  const ready = (fontsLoaded || fontError) && onboardingHydrated;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  return (
    <GestureHandlerRootView className="flex-1">
      <SafeAreaProvider>
        <OnboardingGate />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.surface },
          }}
        />
        <StatusBar style="dark" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
