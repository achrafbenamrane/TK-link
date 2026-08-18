import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { cn } from '@/shared/lib/cn';
import { AppText } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { useWelcomeStore } from '../model/store';
import { FlashScene } from './scenes/flash-scene';
import { NearbyScene } from './scenes/nearby-scene';
import { PacmanScene } from './scenes/pacman-scene';
import { TkMark } from './tk-mark';

/** Temps d'affichage d'un panneau — calé sur la durée d'un cycle de scène. */
const DWELL = 5200;

type Panel = {
  key: string;
  title: string;
  accent: string;
  line: string;
};

const PANELS: Panel[] = [
  {
    key: 'flash',
    // Formulation demandée par la conduite de projet le 18/08 : « des prix qui
    // tombent » décrivait le MÉCANISME, pas le bénéfice, et ne se comprenait
    // pas au premier coup d'œil. Celle-ci dit ce qu'on y gagne et pourquoi il
    // faut se dépêcher — les deux arguments de la vente flash, en six mots.
    title: 'Des prix imbattables,',
    accent: 'pour un temps limité',
    line: 'Les commerçants du quartier bradent ce qui doit partir aujourd’hui. Un compte à rebours, un stock qui fond : vous prenez, ou ça disparaît.',
  },
  {
    // Panneau ajouté le 18/08, à la place de « La Chasse ». Deux panneaux sur
    // trois parlaient de jeux, alors que l'app sert à obtenir des promotions
    // sur un temps court : « un seul panneau suffit ». Celui-ci prend la place
    // libérée pour dire ce que le parcours consommateur promet aux étapes 3
    // et 4 — centres d'intérêt, puis localisation.
    key: 'proximite',
    title: 'Des offres personnalisées,',
    accent: 'tout près de chez vous',
    line: 'Choisissez vos catégories préférées et découvrez les offres flash qui correspondent à côté de chez vous.',
  },
  {
    key: 'jeux',
    title: 'Jouez,',
    accent: 'gagnez pour de vrai',
    line: 'Des mini-jeux qui donnent de vrais coupons — à présenter en caisse, pas des points en l’air.',
  },
];

/**
 * PREMIER ÉCRAN — trois plans qui MONTRENT le produit plutôt que de le décrire.
 *
 * Un écran d'accueil qui aligne trois lignes de texte et un bouton ne prouve
 * rien : on y promet une app « ludique » sans jamais la faire bouger. Ici la
 * carte touche vraiment le lecteur, PacTK croque vraiment la marque, la barre
 * d'XP se remplit vraiment — chaque panneau tient trois secondes et démontre
 * une promesse.
 *
 * Les panneaux défilent seuls (barres de progression en tête, comme une story)
 * mais restent balayables : personne n'est obligé d'attendre, personne n'est
 * obligé d'agir.
 */
export function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  const markSeen = useWelcomeStore((s) => s.markSeen);

  const [index, setIndex] = useState(0);
  const scroller = useRef<ScrollView>(null);
  const panel = PANELS[index]!;
  const stage = Math.min(width - 48, 320);

  // Défilement automatique. En mode « réduire les animations », il n'y a pas
  // d'avance seule : un écran qui bouge tout seul est exactement ce que ce
  // réglage demande d'éviter.
  useEffect(() => {
    if (reduced) return;
    const id = setTimeout(() => {
      const next = (index + 1) % PANELS.length;
      scroller.current?.scrollTo({ x: next * width, animated: true });
      setIndex(next);
    }, DWELL);
    return () => clearTimeout(id);
  }, [index, width, reduced]);

  /**
   * On enchaîne sur l'accueil des nouveaux — rôle, avatar, intérêts, compte.
   * Passer par `/` d'abord ferait clignoter la boutique avant que la porte du
   * layout ne renvoie sur l'onboarding.
   */
  const enter = () => {
    markSeen();
    router.replace('/onboarding');
  };

  /** Un compte existe déjà : rien à personnaliser, on va droit à la connexion. */
  const signIn = () => {
    markSeen();
    router.replace('/sign-in');
  };

  return (
    <View
      testID="welcome-screen"
      className="flex-1 bg-forest-deep"
      style={{ paddingTop: insets.top }}
    >
      {/* Fond très sombre → icônes de statut claires, sinon elles disparaissent. */}
      <StatusBar style="light" />

      {/* En-tête : la marque, et de quoi couper court. */}
      <View className="flex-row items-start justify-between px-6 pb-3 pt-2">
        <TkMark size={22} />
        <Pressable
          testID="welcome-skip"
          accessibilityRole="button"
          accessibilityLabel="Passer l’introduction"
          onPress={enter}
          hitSlop={10}
          className="rounded-pill bg-ink-inverse/10 px-3 py-1.5"
        >
          <AppText className="font-sans-semibold text-ink-inverse/70" style={{ fontSize: 12.5 }}>
            Passer
          </AppText>
        </Pressable>
      </View>

      {/* Progression, façon story : où l'on en est, combien il reste. */}
      <View className="flex-row gap-1.5 px-6">
        {PANELS.map((p, i) => (
          <Segment key={p.key} active={i === index} done={i < index} still={reduced} />
        ))}
      </View>

      {/* Les plans. Balayables — l'automatique ne doit jamais bloquer la main. */}
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) =>
          setIndex(Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width)))
        }
        style={{ flexGrow: 0 }}
      >
        {PANELS.map((p) => (
          <View
            key={p.key}
            testID={`welcome-panel-${p.key}`}
            style={{ width }}
            className="items-center justify-center py-2"
          >
            {p.key === 'flash' ? <FlashScene size={stage} still={reduced} /> : null}
            {p.key === 'jeux' ? <PacmanScene size={stage} still={reduced} /> : null}
            {p.key === 'proximite' ? <NearbyScene size={stage} still={reduced} /> : null}
          </View>
        ))}
      </ScrollView>

      {/* Le discours suit le plan affiché. */}
      <View className="flex-1 justify-start px-6 pt-2">
        <Animated.View key={panel.key} entering={reduced ? undefined : FadeIn.duration(320)}>
          <AppText
            className="font-display text-ink-inverse"
            style={{ fontSize: 30, lineHeight: 40 }}
          >
            {panel.title} <AppText style={{ color: colors.lime }}>{panel.accent}</AppText>
          </AppText>
          <AppText className="mt-2 text-ink-inverse/70" style={{ fontSize: 15, lineHeight: 22 }}>
            {panel.line}
          </AppText>
        </Animated.View>
      </View>

      {/* L'action, toujours au même endroit : elle ne se cherche pas. */}
      <View className="gap-1 px-6" style={{ paddingBottom: insets.bottom + 18 }}>
        <Pressable
          testID="welcome-start"
          accessibilityRole="button"
          accessibilityLabel="Commencer"
          onPress={enter}
          className="flex-row items-center justify-center gap-2 rounded-control bg-lime py-4 active:opacity-85"
        >
          <AppText className="font-sans-bold text-forest-deep" style={{ fontSize: 16 }}>
            Commencer
          </AppText>
          <Feather name="arrow-right" size={18} color={colors.forestDeep} />
        </Pressable>
        <Pressable
          testID="welcome-signin"
          accessibilityRole="button"
          accessibilityLabel="Se connecter"
          onPress={signIn}
          className="py-3"
        >
          <AppText className="text-center text-ink-inverse/60" style={{ fontSize: 14 }}>
            J’ai déjà un compte{' '}
            <AppText className="font-sans-bold text-ink-inverse">Se connecter</AppText>
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Un segment de progression. Le segment actif se remplit sur la durée
 * d'affichage : on sait combien de temps il reste avant le plan suivant, donc
 * on sait qu'attendre est un choix.
 */
function Segment({ active, done, still }: { active: boolean; done: boolean; still: boolean }) {
  const fill = useSharedValue(done ? 1 : 0);

  useEffect(() => {
    if (done) {
      fill.value = 1;
      return;
    }
    if (!active) {
      fill.value = 0;
      return;
    }
    fill.value = 0;
    fill.value = still ? 1 : withTiming(1, { duration: DWELL, easing: Easing.linear });
  }, [active, done, still, fill]);

  const style = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  return (
    <View className={cn('h-1 flex-1 overflow-hidden rounded-pill bg-ink-inverse/15')}>
      <Animated.View style={[style, { height: '100%', backgroundColor: colors.lime }]} />
    </View>
  );
}
