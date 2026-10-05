import { Feather } from '@expo/vector-icons';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { selectUnreadTotal, useMessagesStore } from '@/features/messages';
import { selectRole, useOnboardingStore } from '@/features/onboarding';
import { useColors } from '@/shared/theme/theme-provider';

/**
 * La barre du bas — elle change avec le rôle.
 *
 *   Consommateur : Accueil · Favoris · Commandes · Compte
 *   Commerçant   : Accueil · Commandes · [ FLASH ] · Fidélité · Compte
 *   Livreur      : Accueil · Missions · Carte · Messages · Compte
 *   Grossiste    : Accueil · Commandes · [ OFFRES ] · Compte
 *
 * Chez le consommateur, l'accueil, ce sont les ventes Flash (CDC §3.1). « La
 * Chasse », qui occupait le centre, a disparu le 03/10/2026 : ni la V1.0 ni la
 * V1.1 ne décrivent sa gamification, et les mini-jeux sont un lot séparé, hors
 * du pilote (V1.1, Utilisateur).
 *
 * Chez le commerçant, la barre est celle de la maquette du client : au centre,
 * l'onglet « Flash » — créer une opération, c'est le geste de tout son métier
 * sur TK LINK. « Commandes » est l'écran d'ouverture de l'appareil (V1.1 : la
 * liste des commandes en cours, ni réglages ni chiffres) ; le tableau de bord est
 * dans « Accueil ».
 *
 * « Parcourir » n'existe plus. Les tickets et la fidélité de chaque commerçant
 * se rejoignent depuis le compte et les fiches commerçant.
 */

/** La pastille du milieu — surélevée, pour qu'on la vise au pouce. */
function FlashTabIcon({ focused }: { focused: boolean }) {
  const colors = useColors();
  return (
    <View
      className="h-12 w-12 items-center justify-center rounded-pill bg-brand-500"
      style={{
        marginTop: -18,
        opacity: focused ? 1 : 0.9,
        shadowColor: colors.brand500,
        shadowOpacity: 0.5,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 8,
      }}
    >
      <Feather name="zap" size={22} color={colors.inkInverse} />
    </View>
  );
}

export default function TabsLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const role = useOnboardingStore(selectRole);

  const pro = role === 'commercant';
  const courier = role === 'livreur';
  const wholesaler = role === 'grossiste';
  const unread = useMessagesStore(selectUnreadTotal);

  // L'appareil du commerçant s'ouvre sur les commandes en cours (V1.1), pas sur
  // le tableau de bord. Une seule fois par lancement : cette disposition reste
  // montée tant que l'app tourne. Un lien profond vers un autre écran n'est pas
  // détourné — on ne bascule que si l'on arrive sur l'accueil.
  const router = useRouter();
  const pathname = usePathname();
  const landed = useRef(false);
  useEffect(() => {
    if (!pro || landed.current) return;
    landed.current = true;
    if (pathname === '/') router.replace('/commandes');
  }, [pro, pathname, router]);

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
          // Hauteur explicite : la pastille centrale du commerçant déborde vers
          // le haut, il lui faut la place. En la fixant, on reprend aussi la
          // marge basse que la barre ajoutait seule — d'où le `paddingBottom`.
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
          title: 'Accueil',
          tabBarIcon: ({ color }) => <Feather name="home" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="favoris"
        options={{
          href: pro || courier || wholesaler ? null : undefined,
          title: 'Favoris',
          tabBarIcon: ({ color }) => <Feather name="heart" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="commandes"
        options={{
          // Chez le livreur, l'historique des livraisons s'ouvre depuis l'accueil.
          href: courier ? null : undefined,
          title: 'Commandes',
          tabBarIcon: ({ color }) => <Feather name="clipboard" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="flash"
        options={{
          href: pro || wholesaler ? undefined : null,
          title: wholesaler ? 'Offres' : 'Flash',
          // Le grossiste a un onglet comme les autres : seule la maquette du commerçant surélève « Flash ».
          tabBarIcon: ({ focused, color }) =>
            wholesaler ? (
              <Feather name="package" size={22} color={color} />
            ) : (
              <FlashTabIcon focused={focused} />
            ),
        }}
      />
      <Tabs.Screen
        name="fidelite"
        options={{
          href: pro ? undefined : null,
          title: 'Fidélité',
          tabBarIcon: ({ color }) => <Feather name="award" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="missions"
        options={{
          href: courier ? undefined : null,
          title: 'Missions',
          tabBarIcon: ({ color }) => <Feather name="clipboard" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="carte"
        options={{
          href: courier ? undefined : null,
          title: 'Carte',
          tabBarIcon: ({ color }) => <Feather name="map-pin" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          href: courier ? undefined : null,
          title: 'Messages',
          tabBarBadge: courier && unread > 0 ? unread : undefined,
          tabBarIcon: ({ color }) => <Feather name="message-square" size={22} color={color} />,
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
    </Tabs>
  );
}
