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

import { useWelcomeStore } from '@/features/welcome';
import '@/shared/lib/env'; // fail fast on invalid environment (has safe defaults)
import { colors } from '@/shared/theme/colors';

/**
 * Redirige vers l'accueil animé au premier lancement. On attend `hydrated`
 * (lecture du disque terminée) avant de décider, sinon un utilisateur qui
 * revient verrait l'accueil clignoter le temps que le stockage se charge.
 */
function WelcomeGate() {
  const router = useRouter();
  const segments = useSegments();
  const seen = useWelcomeStore((s) => s.seen);
  const hydrated = useWelcomeStore((s) => s.hydrated);

  useEffect(() => {
    if (!hydrated || seen) return;
    if (segments[0] !== 'welcome') router.replace('/welcome');
  }, [hydrated, seen, segments, router]);

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

  const welcomeHydrated = useWelcomeStore((s) => s.hydrated);

  // On garde l'écran de démarrage natif jusqu'à ce que la police ET la décision
  // « accueil déjà vu ? » soient prêtes : la porte redirige alors avant le
  // premier rendu visible, donc pas de flash.
  const ready = (fontsLoaded || fontError) && welcomeHydrated;

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
        <WelcomeGate />
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
