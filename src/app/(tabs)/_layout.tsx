import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { selectRole, useOnboardingStore } from '@/features/onboarding';
import { selectTotalUnread, useShopStore } from '@/features/shop';
import { colors } from '@/shared/theme/colors';

/**
 * La barre du bas, à quatre onglets :
 *
 *   Accueil · Favoris · Commandes · Compte
 *
 * L'accueil, ce sont les ventes Flash (CDC §3.1). « La Chasse », qui occupait
 * le centre, a disparu le 03/10/2026 : ni la V1.0 ni la V1.1 du cahier des
 * charges ne décrivent sa gamification, et les mini-jeux sont un lot séparé,
 * hors du pilote (V1.1, Utilisateur). Arbitrage du même jour : les écrans de
 * la maquette B, sans onglet central — docs/design/maquettes/README.md.
 *
 * « Parcourir » reste une ROUTE (la recherche par commerce) mais quitte la
 * barre. Même chose pour les tickets et la fidélité de chaque commerçant, qu'on
 * rejoint depuis le compte et les fiches commerçant.
 */

export default function TabsLayout() {
  const unread = useShopStore(selectTotalUnread);
  const insets = useSafeAreaInsets();
  const role = useOnboardingStore(selectRole);

  /**
   * La barre change avec le rôle — décision client du 2026-08-10.
   *
   * Un commerçant vient s'approvisionner : ses lots, ses achats, son compte.
   * Lui proposer des favoris de consommateur serait lui donner l'app de
   * quelqu'un d'autre. Ses ventes se pilotent sur l'espace pro web, pas ici.
   */
  const pro = role === 'commercant';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand500,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          borderTopWidth: 1,
          // Hauteur explicite : en la fixant, on reprend aussi la marge basse
          // que la barre ajoutait seule — d'où le `paddingBottom` ci-dessous.
          height: 62 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontFamily: 'Manrope_600SemiBold', fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: pro ? 'Lots' : 'Accueil',
          tabBarIcon: ({ color }) => (
            <Feather name={pro ? 'package' : 'home'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="favoris"
        options={{
          href: pro ? null : undefined,
          title: 'Favoris',
          tabBarIcon: ({ color }) => <Feather name="heart" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="commandes"
        options={{
          title: pro ? 'Mes achats' : 'Commandes',
          tabBarIcon: ({ color }) => (
            <Feather name={pro ? 'shopping-bag' : 'clipboard'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: 'Compte',
          // Un bonhomme, pas un engrenage. L'onglet mène au profil, aux
          // paliers et aux adresses — pas à des réglages. Un engrenage promet
          // la configuration de l'app.
          tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} />,
        }}
      />

      {/* Routes conservées, hors barre d'onglets — on y accède depuis le compte,
          les fiches commerçant ou l'accueil. */}
      <Tabs.Screen
        name="chat"
        options={{
          href: null,
          tabBarBadge: unread > 0 ? unread : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.brand500, fontSize: 10 },
        }}
      />
      <Tabs.Screen name="parcourir" options={{ href: null }} />
    </Tabs>
  );
}
