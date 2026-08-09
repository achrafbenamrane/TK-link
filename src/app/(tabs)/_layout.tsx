import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { selectTotalUnread, useShopStore } from '@/features/shop';
import { colors } from '@/shared/theme/colors';

/**
 * La navigation reprend EXACTEMENT le parcours de la maquette du client :
 *
 *   Accueil · Favoris · Parcourir · Commandes · Compte
 *
 * L'accueil, ce sont les ventes flash — pas le portefeuille de tickets. Les
 * apports TK LINK (tickets dématérialisés, carte de fidélité, cadeaux, jeux)
 * se rejoignent depuis le compte et les fiches commerçant, sans déplacer les
 * cinq entrées que le client a validées.
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
        name="parcourir"
        options={{
          title: 'Parcourir',
          tabBarIcon: ({ color }) => <Feather name="search" size={22} color={color} />,
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
      <Tabs.Screen name="carte" options={{ href: null }} />
      <Tabs.Screen name="offres" options={{ href: null }} />
      <Tabs.Screen name="jeux" options={{ href: null }} />
    </Tabs>
  );
}
