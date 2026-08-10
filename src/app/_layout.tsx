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
import { receiptForOrder, useReceiptsStore } from '@/features/receipts';
import { orderToTransaction, producesReceipt, selectOrders, useShopStore } from '@/features/shop';
import { useWelcomeStore } from '@/features/welcome';
import '@/shared/lib/env'; // fail fast on invalid environment (has safe defaults)
import { colors } from '@/shared/theme/colors';

/**
 * Écrans qu'un nouvel arrivant a le droit de voir avant d'avoir fini l'accueil.
 *
 * Sans cette liste, l'étape « compte » serait un piège : elle envoie vers
 * l'inscription ou la connexion, et la porte les renverrait aussitôt à
 * l'onboarding puisqu'il n'est pas terminé.
 */
const FIRST_RUN_ROUTES = new Set(['welcome', 'onboarding', 'sign-in', 'sign-up']);

/**
 * LA PORTE DU PREMIER LANCEMENT : bienvenue → onboarding → app.
 *
 * L'écran de bienvenue montre le produit (la carte, les jeux, la chasse) ;
 * l'onboarding personnalise et propose le compte. L'ordre compte : demander un
 * avatar et un mot de passe à quelqu'un qui n'a pas encore vu ce que fait
 * l'app, c'est le perdre.
 *
 * On attend `hydrated` (lecture du disque terminée) avant de décider, sinon un
 * utilisateur qui revient verrait l'accueil clignoter le temps que le stockage
 * se charge — les deux drapeaux valant `false` par défaut.
 */
function FirstRunGate() {
  const router = useRouter();
  const segments = useSegments();
  const completed = useOnboardingStore(selectCompleted);
  const onboardingHydrated = useOnboardingStore(selectHydrated);
  const seenWelcome = useWelcomeStore((s) => s.seen);
  const welcomeHydrated = useWelcomeStore((s) => s.hydrated);

  useEffect(() => {
    if (!onboardingHydrated || !welcomeHydrated) return;
    const here = segments[0] ?? '';

    if (!seenWelcome) {
      if (here !== 'welcome') router.replace('/welcome');
      return;
    }
    if (!completed && !FIRST_RUN_ROUTES.has(here)) router.replace('/onboarding');
  }, [onboardingHydrated, welcomeHydrated, seenWelcome, completed, segments, router]);

  return null;
}

/**
 * LE PONT COMMANDE → TICKET — CDC §14.
 *
 * « Transaction → Ticket → Facture. » La boutique produit des commandes, le
 * portefeuille produit des tickets, et jusqu'ici rien ne les reliait : une
 * commande remise au client ne laissait aucune trace, alors que le ticket
 * dématérialisé EST la promesse de la marque.
 *
 * Ce pont vit à la racine et non dans un écran : un ticket ne doit pas
 * dépendre de la page qu'on regardait au moment où la commande s'est
 * terminée. Les deux features s'ignorent toujours — elles se rencontrent ici,
 * comme partout ailleurs dans `src/app`.
 *
 * L'idempotence tient au champ `orderId` du ticket : une commande déjà
 * facturée est reconnue, donc repasser cent fois n'émet jamais un doublon.
 */
function ReceiptBridge() {
  const orders = useShopStore(selectOrders);
  const receipts = useReceiptsStore((s) => s.receipts);
  const addReceipt = useReceiptsStore((s) => s.addReceipt);
  const purgeExpired = useReceiptsStore((s) => s.purgeExpired);

  // CDC §16 — au démarrage, et une seule fois : les documents dont la durée de
  // conservation est écoulée s'en vont. Garder un historique d'achats au-delà
  // du nécessaire est une donnée personnelle de trop, pas un service rendu.
  useEffect(() => {
    purgeExpired();
  }, [purgeExpired]);

  useEffect(() => {
    for (const order of orders) {
      if (!producesReceipt(order)) continue;
      if (receiptForOrder(receipts, order.id)) continue;
      addReceipt(orderToTransaction(order));
    }
  }, [orders, receipts, addReceipt]);

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
  const welcomeHydrated = useWelcomeStore((s) => s.hydrated);

  // On garde l'écran de démarrage natif jusqu'à ce que la police ET les deux
  // décisions du premier lancement (« bienvenue déjà vue ? », « onboarding
  // fait ? ») soient prêtes : la porte redirige alors avant le premier rendu
  // visible, donc pas de clignotement.
  const ready = (fontsLoaded || fontError) && onboardingHydrated && welcomeHydrated;

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
        <FirstRunGate />
        <ReceiptBridge />
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
