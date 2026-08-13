import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { selectRole, useOnboardingStore } from '@/features/onboarding';
import { selectTotalUnread, useShopStore } from '@/features/shop';
import { cn } from '@/shared/lib/cn';
import { colors } from '@/shared/theme/colors';

/**
 * La barre du bas, à cinq onglets :
 *
 *   Accueil · Favoris · [ LA CHASSE ] · Commandes · Compte
 *
 * L'accueil, ce sont les ventes flash. Au CENTRE, « La Chasse » réunit ce qui
 * rapporte — déstockage, offres membres, mini-jeux et toute la progression :
 * séparer les offres des jeux cassait la boucle (on jouait sans voir ce qu'on
 * pouvait attraper). Sa pastille est surélevée : c'est l'onglet qu'on veut
 * atteindre sans regarder.
 *
 * « Parcourir » reste une ROUTE (la recherche par commerce) mais quitte la
 * barre. Même chose pour les écrans TK LINK — tickets, carte de fidélité,
 * cadeaux, menu complet des jeux — qu'on rejoint depuis le compte, le hub et
 * les fiches commerçant.
 */

/** La pastille du milieu — surélevée, pour qu'on la vise au pouce. */
function HubTabIcon({ focused }: { focused: boolean }) {
  return (
    <View
      className={cn(
        'h-11 w-11 items-center justify-center rounded-pill',
        focused ? 'bg-brand-500' : 'bg-surface-inverse',
      )}
      style={{
        marginTop: -14,
        shadowColor: colors.forestDeep,
        shadowOpacity: 0.25,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
      }}
    >
      <Feather name="target" size={22} color={focused ? colors.inkInverse : colors.lime} />
    </View>
  );
}

export default function TabsLayout() {
  const unread = useShopStore(selectTotalUnread);
  const insets = useSafeAreaInsets();
  const role = useOnboardingStore(selectRole);

  /**
   * La barre change avec le rôle — décision client du 2026-08-10.
   *
   * Un commerçant vient s'approvisionner : ses lots, ses achats, son compte.
   * Lui proposer « La Chasse » (jeux, XP, coffre) et des favoris de
   * consommateur serait lui donner l'app de quelqu'un d'autre. Ses ventes se
   * pilotent sur l'espace pro web, pas ici.
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
          // Hauteur explicite : la pastille centrale déborde vers le haut, il
          // lui faut la place. En la fixant, on reprend aussi la marge basse
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
        name="chasse"
        options={{
          href: pro ? null : undefined,
          title: 'La Chasse',
          tabBarIcon: ({ focused }) => <HubTabIcon focused={focused} />,
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
          // Un bonhomme, pas un engrenage. L'onglet mène au profil, à la carte
          // de fidélité, aux points et aux adresses — pas à des réglages. Un
          // engrenage promet la configuration de l'app : on le cherche pour
          // couper les notifications, et on tombe sur sa carte de fidélité.
          tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} />,
        }}
      />

      {/* Routes conservées, hors barre d'onglets — on y accède depuis le compte,
          le hub, les fiches commerçant ou l'accueil. */}
      <Tabs.Screen
        name="chat"
        options={{
          href: null,
          tabBarBadge: unread > 0 ? unread : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.brand500, fontSize: 10 },
        }}
      />
      <Tabs.Screen name="parcourir" options={{ href: null }} />
      <Tabs.Screen name="carte" options={{ href: null }} />
      <Tabs.Screen name="offres" options={{ href: null }} />
      <Tabs.Screen name="jeux" options={{ href: null }} />
    </Tabs>
  );
}
