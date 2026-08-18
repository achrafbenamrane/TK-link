import { Feather } from '@expo/vector-icons';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { AppText } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

/** Un tour : l'ancien prix tombe, le nouveau se pose, le stock fond. */
const CYCLE = 5200;

/**
 * L'offre montrée. Ce sont les VRAIES valeurs du catalogue (`d_viennoiseries`) :
 * le premier écran ne doit pas promettre une remise que l'app ne contient pas.
 */
const OFFER = {
  merchant: 'Boulangerie Saint-Cyprien',
  title: 'Panier viennoiseries',
  emoji: '🥐',
  price: '4,50€',
  oldPrice: '11,00€',
  discount: '-59%',
  stockLeft: 4,
  stockTotal: 15,
  countdown: '15:00',
};

/** Vert clair de la marque, en voile — sert de bordure et de fonds discrets. */
const LIME_VEIL = 'rgba(195, 245, 60, 0.16)';
const LIME_EDGE = 'rgba(195, 245, 60, 0.28)';
const INK_VEIL = 'rgba(242, 247, 240, 0.14)';
const INK_SOFT = 'rgba(242, 247, 240, 0.62)';
const INK_FADED = 'rgba(242, 247, 240, 0.45)';

type Props = { size?: number; still?: boolean };

/**
 * LA PROMESSE DU PRODUIT : un prix qui tombe, et qui ne reviendra pas.
 *
 * Cette scène a remplacé « la carte qu'on passe sur le lecteur » — ce matériel
 * ne sera pas réalisé, et le premier écran doit parler au client : « montrer que
 * l'application sert à obtenir des offres flash, des promotions importantes avec
 * des dates courtes » (conduite de projet, 13/08/2026).
 *
 * Deuxième version, après retour du 16/08 : la précédente posait une **carte
 * blanche** au milieu d'un écran vert foncé — un rectangle clair qui cassait
 * l'identité de la marque et attirait l'œil avant le message. Tout est
 * désormais dans les verts de TK LINK, et le mouvement ne décore plus : il
 * DÉMONTRE. L'ancien prix tombe hors de la carte, le nouveau se pose à sa
 * place, la barre de stock se vide et vire au rouge. Une capture fixe dirait
 * « il y a des promotions » ; ce mouvement dit « ça part MAINTENANT ».
 */
export function FlashScene({ size = 300, still = false }: Props) {
  // À l'arrêt, on fige le cycle APRÈS la bascule : le nouveau prix est posé, la
  // remise est lisible, le stock a déjà entamé sa descente. Figer à zéro
  // montrerait une carte vide — le pire des états pour qui coupe les animations.
  const progress = useSharedValue(still ? 0.62 : 0);

  useEffect(() => {
    if (still) return;
    progress.value = withRepeat(
      withTiming(1, { duration: CYCLE, easing: Easing.linear }),
      -1,
      false,
    );
  }, [progress, still]);

  return (
    <View
      testID="welcome-flash"
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Une vente flash : ${OFFER.title} à ${OFFER.price} au lieu de ${OFFER.oldPrice}, ${OFFER.discount}. Il reste ${OFFER.stockLeft} paniers sur ${OFFER.stockTotal} et quelques minutes.`}
      style={{ width: size, height: size }}
      className="items-center justify-center"
    >
      <View
        style={{
          width: size * 0.92,
          borderRadius: size * 0.075,
          borderWidth: 1,
          borderColor: LIME_EDGE,
          backgroundColor: colors.forest,
          paddingHorizontal: size * 0.055,
          paddingVertical: size * 0.05,
          gap: size * 0.038,
          shadowColor: '#000000',
          shadowOpacity: 0.5,
          shadowRadius: size * 0.055,
          shadowOffset: { width: 0, height: size * 0.028 },
          elevation: 12,
        }}
      >
        <Identity size={size} />
        <PriceDrop progress={progress} size={size} />
        <Stock progress={progress} size={size} />
      </View>
    </View>
  );
}

/** Qui vend, et quoi — les deux informations que le §3.1 du CDC exige en tête. */
function Identity({ size }: { size: number }) {
  return (
    <View className="flex-row items-center" style={{ gap: size * 0.038 }}>
      <View
        className="items-center justify-center"
        style={{
          width: size * 0.1,
          height: size * 0.1,
          borderRadius: size * 0.05,
          backgroundColor: LIME_VEIL,
        }}
      >
        <AppText style={{ fontSize: size * 0.048 }}>{OFFER.emoji}</AppText>
      </View>

      <View className="flex-1">
        {/* Le quartier n'est PAS répété ici : « Boulangerie Saint-Cyprien ·
            Saint-Cyprien » disait deux fois la même chose et débordait, ce qui
            tronquait la ligne en « Saint-C… ». Le nom de l'enseigne le porte
            déjà. */}
        <AppText
          className="font-sans-medium"
          numberOfLines={1}
          style={{ fontSize: size * 0.033, color: INK_SOFT }}
        >
          {OFFER.merchant}
        </AppText>
        <AppText
          className="font-display text-ink-inverse"
          numberOfLines={1}
          style={{ fontSize: size * 0.046 }}
        >
          {OFFER.title}
        </AppText>
      </View>
    </View>
  );
}

/**
 * LES DEUX PRIX, TOUJOURS LISIBLES — et c'est une correction, pas un choix.
 *
 * La première version faisait TOMBER l'ancien prix hors du bloc puis le faisait
 * disparaître. Joli sur le papier, faux à l'usage : l'ancien prix n'était
 * visible que pendant un cinquième du cycle. Le reste du temps, la carte
 * montrait « 4,50 € » à côté d'un « -59 % » sans rien à quoi le comparer — la
 * remise ne voulait plus rien dire, et la conduite de projet l'a vu tout de
 * suite.
 *
 * Les deux prix sont donc PERMANENTS, côte à côte, comme sur la vraie carte de
 * l'app. Plus aucune opacité animée non plus : une valeur qui va de 0 à 1 puis
 * repart à 0 à chaque boucle fait clignoter le prix au raccord. Il ne reste
 * qu'une pulsation d'échelle, qui anime sans jamais rien cacher.
 */
function PriceDrop({ progress, size }: { progress: SharedValue<number>; size: number }) {
  const priceStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(progress.value, [0, 0.14, 0.24], [0.94, 1.05, 1], Extrapolation.CLAMP),
      },
    ],
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(progress.value, [0.24, 0.36, 0.44], [0.9, 1.12, 1], Extrapolation.CLAMP),
      },
    ],
  }));

  return (
    <View className="flex-row items-center justify-between" style={{ gap: size * 0.03 }}>
      <Animated.View
        style={[priceStyle, { flexDirection: 'row', alignItems: 'baseline', gap: size * 0.028 }]}
      >
        <AppText className="font-display" style={{ fontSize: size * 0.095, color: colors.lime }}>
          {OFFER.price}
        </AppText>
        <AppText
          className="font-sans-semibold line-through"
          style={{ fontSize: size * 0.042, color: INK_FADED }}
        >
          {OFFER.oldPrice}
        </AppText>
      </Animated.View>

      <Animated.View
        style={[
          badgeStyle,
          {
            backgroundColor: colors.lime,
            borderRadius: size * 0.028,
            paddingHorizontal: size * 0.038,
            paddingVertical: size * 0.015,
          },
        ]}
      >
        <AppText
          className="font-display"
          style={{ fontSize: size * 0.05, color: colors.forestDeep }}
        >
          {OFFER.discount}
        </AppText>
      </Animated.View>
    </View>
  );
}

/**
 * Ce qu'il reste, et le temps qu'il reste.
 *
 * La barre se vide et vire au rouge sur la fin : la couleur dit l'urgence sans
 * qu'on ait à faire tourner une horloge. Le compte à rebours reste un texte
 * FIXE — le faire défiler seconde par seconde imposerait un rendu React chaque
 * seconde sur le tout premier écran de l'app, pendant que trois scènes tournent
 * déjà. Le mouvement est porté par la barre, qui coûte zéro rendu.
 */
function Stock({ progress, size }: { progress: SharedValue<number>; size: number }) {
  const fillStyle = useAnimatedStyle(() => ({
    width: `${interpolate(progress.value, [0.34, 0.92], [100, 18], Extrapolation.CLAMP)}%`,
    backgroundColor: interpolateColor(
      progress.value,
      [0.34, 0.72, 0.92],
      [colors.lime, colors.lime, colors.danger],
    ),
  }));

  const clockStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0.55, 0.78], [INK_VEIL, colors.danger]),
  }));

  return (
    <View style={{ gap: size * 0.028 }}>
      <View
        style={{
          height: size * 0.022,
          borderRadius: size * 0.011,
          backgroundColor: INK_VEIL,
          overflow: 'hidden',
        }}
      >
        <Animated.View style={[fillStyle, { height: '100%', borderRadius: size * 0.011 }]} />
      </View>

      <View className="flex-row items-center justify-between">
        <AppText className="font-sans-bold" style={{ fontSize: size * 0.036, color: colors.lime }}>
          Plus que {OFFER.stockLeft}{' '}
          <AppText className="font-sans-medium" style={{ color: INK_SOFT }}>
            sur {OFFER.stockTotal}
          </AppText>
        </AppText>

        <Animated.View
          className="flex-row items-center"
          style={[
            clockStyle,
            {
              gap: size * 0.016,
              borderRadius: size * 0.05,
              paddingHorizontal: size * 0.032,
              paddingVertical: size * 0.014,
            },
          ]}
        >
          <Feather name="clock" size={size * 0.038} color={colors.inkInverse} />
          <AppText className="font-sans-bold text-ink-inverse" style={{ fontSize: size * 0.036 }}>
            {OFFER.countdown}
          </AppText>
        </Animated.View>
      </View>
    </View>
  );
}
