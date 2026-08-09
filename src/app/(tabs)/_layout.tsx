import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { selectTotalUnread, useShopStore } from '@/features/shop';
import { colors } from '@/shared/theme/colors';

/**
 * La barre du bas :
 *
 *   Accueil · Favoris · Commandes · Compte
 *
 * L'accueil, ce sont les ventes flash. « Parcourir » reste une ROUTE (la
 * recherche par commerce, avec les flashs en cours de chaque enseigne) mais
 * quitte la barre : le client ne la veut pas là. Même chose pour les apports
 * TK LINK — tickets, carte de fidélité, cadeaux, jeux — qu'on rejoint depuis
 * le compte et les fiches commerçant.
 */
export default function TabsLayout() {
  const unread = useShopStore(selectTotalUnread);

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
        },
        tabBarLabelStyle: { fontFamily: 'Manrope_600SemiBold', fontSize: 11 },
        tabBarItemStyle: { paddingTop: 4 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color }) => <Feather name="home" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="favoris"
        options={{
          title: 'Favoris',
          tabBarIcon: ({ color }) => <Feather name="heart" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="commandes"
        options={{
          title: 'Commandes',
          tabBarIcon: ({ color }) => <Feather name="clipboard" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: 'Compte',
          tabBarIcon: ({ color }) => <Feather name="settings" size={22} color={color} />,
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
      <Tabs.Screen name="carte" options={{ href: null }} />
      <Tabs.Screen name="offres" options={{ href: null }} />
      <Tabs.Screen name="jeux" options={{ href: null }} />
    </Tabs>
  );
}
