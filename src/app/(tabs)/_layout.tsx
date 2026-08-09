import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { colors } from '@/shared/theme/colors';

/**
 * La navigation de TK LINK, dans l'ordre où l'on s'en sert :
 *
 *  Tickets — le portefeuille, la raison d'être du produit
 *  Carte   — ce qu'on ouvre devant le lecteur en caisse
 *  Offres  — PROMO + CATALOGUE du menu de la vidéo
 *  Jeux    — la gamification, qui alimente les points
 *  Profil  — compte, cadeaux, réglages
 *
 * Les écrans hérités de la place de marché (favoris, commandes, messagerie)
 * restent des routes accessibles, mais quittent la barre d'onglets : TK LINK
 * n'est pas une boutique, on n'y passe pas commande.
 */
export default function TabsLayout() {
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
          title: 'Tickets',
          tabBarIcon: ({ color }) => <Feather name="file-text" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="carte"
        options={{
          title: 'Ma carte',
          tabBarIcon: ({ color }) => <Feather name="credit-card" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="offres"
        options={{
          title: 'Offres',
          tabBarIcon: ({ color }) => <Feather name="tag" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="jeux"
        options={{
          title: 'Jeux',
          tabBarIcon: ({ color }) => <Feather name="target" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} />,
        }}
      />

      {/* Routes conservées, hors barre d'onglets. */}
      <Tabs.Screen name="favoris" options={{ href: null }} />
      <Tabs.Screen name="commandes" options={{ href: null }} />
      <Tabs.Screen name="chat" options={{ href: null }} />
    </Tabs>
  );
}
