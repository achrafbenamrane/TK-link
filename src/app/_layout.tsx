import '../global.css';

import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  decideEntry,
  isDemoSession,
  selectAuthStatus,
  selectSession,
  useAuthStore,
  type EntryRoute,
} from '@/features/auth';
import {
  selectCompleted,
  selectHydrated,
  selectRole,
  useOnboardingStore,
} from '@/features/onboarding';
import { PushBridge } from '@/features/notifications';
import { receiptForOrder, useReceiptsStore } from '@/features/receipts';
import { orderToTransaction, producesReceipt, selectOrders, useShopStore } from '@/features/shop';
import { useWelcomeStore } from '@/features/welcome';
import { isSupabaseConfigured } from '@/shared/lib/env'; // fail fast on invalid environment (has safe defaults)
import { forgetRetiredStores } from '@/shared/lib/retired-stores';
import { registerSupabaseAutoRefresh } from '@/shared/lib/supabase';
import { logger } from '@/shared/lib/logger';
import { ErrorScreen } from '@/shared/ui';
import { ThemeProvider, useColors, useScheme } from '@/shared/theme/theme-provider';

import { resetLocalData } from './(tabs)/profil';
import { adoptServerProfile } from './sign-in';

/** Les écrans d'un compte déconnecté : y aller, c'est quitter l'app — la pile ne doit rien garder. */
const SIGNED_OUT_ROUTES: ReadonlySet<EntryRoute> = new Set(['/welcome', '/role', '/sign-in']);

/**
 * LA PORTE DU LANCEMENT : logo animé → choix du profil → inscription → accueil → app.
 *
 * Un compte est OBLIGATOIRE (décision du client, 24/10/2026) : sans session, seuls le logo, le choix
 * du profil, l'inscription, la connexion et le mot de passe oublié s'ouvrent. La règle vit dans
 * `decideEntry` (feature `auth`), testée seule ; ce composant lui donne l'état et applique sa
 * réponse. C'est le SEUL à naviguer au lancement : le logo animé dit seulement qu'il a fini.
 *
 * Elle attend que le disque ET la session soient relus avant de décider (sauf pour le logo, qui joue
 * pendant ce temps) : un compte connecté ne voit jamais passer le choix du profil.
 */
function EntryGate() {
  const router = useRouter();
  const segments = useSegments();
  const completed = useOnboardingStore(selectCompleted);
  const role = useOnboardingStore(selectRole);
  const onboardingHydrated = useOnboardingStore(selectHydrated);
  const splashDone = useWelcomeStore((s) => s.splashDone);
  const welcomeHydrated = useWelcomeStore((s) => s.hydrated);
  const auth = useAuthStore(selectAuthStatus);
  const here = segments[0] ?? '';

  useEffect(() => {
    const target = decideEntry({
      hydrated: onboardingHydrated && welcomeHydrated,
      splashDone,
      auth,
      onboardingCompleted: completed,
      role,
      here,
    });
    if (!target) return;
    // `replace` ne change que l'écran du dessus : après une déconnexion depuis « Mon compte »,
    // l'accueil resterait dessous, et le geste retour le rouvrirait le temps d'un éclair.
    if (SIGNED_OUT_ROUTES.has(target) && router.canDismiss()) router.dismissAll();
    router.replace(target);
  }, [onboardingHydrated, welcomeHydrated, splashDone, auth, completed, role, here, router]);

  return null;
}

/**
 * LES NOTIFICATIONS (rapport d'avancement du 13/11/2026) : le téléphone s'enregistre pour le compte
 * connecté, et une notification touchée ouvre son écran — une fois passés le logo animé et la porte
 * d'entrée, qui écraseraient sinon le lien. Rien en démonstration (pas de serveur pour envoyer).
 */
function Notifications() {
  const router = useRouter();
  const session = useAuthStore(selectSession);
  const auth = useAuthStore(selectAuthStatus);
  const completed = useOnboardingStore(selectCompleted);
  const splashDone = useWelcomeStore((s) => s.splashDone);
  const segments = useSegments();
  const userId = session && !isDemoSession(session) ? session.user.id : null;
  const ready =
    isSupabaseConfigured &&
    auth === 'authenticated' &&
    userId !== null &&
    completed &&
    splashDone &&
    (segments[0] ?? '') !== 'welcome';
  return <PushBridge ready={ready} accountId={userId} onOpen={(route) => router.push(route)} />;
}

/**
 * LE COMPTE ET L'APPAREIL — une fois par compte et par lancement, dès qu'une VRAIE session existe
 * (connexion, ou session relue au démarrage) :
 *
 * 1. Un AUTRE compte que celui à qui appartient le profil local (session expirée sans déconnexion,
 *    puis quelqu'un d'autre se connecte) : les données locales du précédent repartent de zéro.
 * 2. L'accueil n'est pas fini sur cet appareil : le type de compte DÉCLARÉ est relu sur le serveur,
 *    et si le compte a déjà fait l'accueil, il est marqué fait ici aussi (centres d'intérêt compris).
 *    Une connexion interrompue (app fermée, réseau) ne laisse donc pas un professionnel dans
 *    l'accueil d'un client, ni une personne déjà inscrite dans les centres d'intérêt. Rien n'est
 *    déclaré ici : c'est un geste d'inscription.
 *
 * En démonstration, rien : pas de serveur, et les données d'exemple appartiennent à la démo.
 */
function AccountSync() {
  const session = useAuthStore(selectSession);
  const syncProfile = useAuthStore((s) => s.syncProfile);
  const userId = session && !isDemoSession(session) ? session.user.id : null;
  const synced = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || synced.current === userId) return;
    synced.current = userId;
    const local = useOnboardingStore.getState();
    // Seul un profil INSTALLÉ (accueil terminé) appartient vraiment à quelqu'un ; en cours
    // d'inscription, ce qui vient d'être saisi est celui du nouveau compte.
    if (local.completed && local.ownerId && local.ownerId !== userId) resetLocalData();
    useOnboardingStore.getState().setOwnerId(userId);
    if (useOnboardingStore.getState().completed) return;
    const localRole = useOnboardingStore.getState().role;
    void syncProfile(localRole, { declare: false }).then((profile) => {
      // Un type non déclaré n'écrase pas le profil choisi (inscription Google ou Apple en cours).
      if (profile) adoptServerProfile(profile, profile.declared ? profile.accountType : localRole);
    });
  }, [userId, syncProfile]);

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

/**
 * L'écran d'erreur de toute l'app : expo-router l'affiche quand un écran plante, à la place d'un écran
 * blanc. Il remplace aussi la disposition, donc il apporte son propre thème.
 */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  // Le journal masque les secrets (voir `logger`) ; le message n'est montré qu'en développement.
  logger.error('Écran en erreur', { message: error.message });
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <ErrorScreen onRetry={() => void retry()} detail={__DEV__ ? error.message : undefined} />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

SplashScreen.preventAutoHideAsync();

/**
 * La pile de navigation et la barre d'état — dans le thème, donc sous le
 * `ThemeProvider` : leurs couleurs suivent le mode Nuit / Jour.
 */
function AppStack() {
  const colors = useColors();
  const scheme = useScheme();
  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.surface },
        }}
      />
      <StatusBar style={scheme === 'night' ? 'light' : 'dark'} />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  // LA SESSION — relue dès le démarrage, AVANT que la porte ne décide (elle attend son statut), puis
  // suivie : connexion, déconnexion, jeton renouvelé. Le renouvellement automatique ne tourne qu'au
  // premier plan (`registerSupabaseAutoRefresh`) : inutile de réveiller le réseau en arrière-plan.
  // L'écran de démarrage natif, lui, n'attend PAS la session : sans réseau, il resterait figé.
  useEffect(() => {
    const stopListening = useAuthStore.getState().init();
    const stopRefresh = isSupabaseConfigured ? registerSupabaseAutoRefresh() : () => {};
    return () => {
      stopListening();
      stopRefresh();
    };
  }, []);

  // Ce que les fonctions retirées (le livreur, 13/11/2026) avaient écrit sur ce téléphone.
  useEffect(() => {
    void forgetRetiredStores();
  }, []);

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
      <ThemeProvider>
        <SafeAreaProvider>
          <EntryGate />
          <AccountSync />
          <ReceiptBridge />
          <Notifications />
          <AppStack />
        </SafeAreaProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
