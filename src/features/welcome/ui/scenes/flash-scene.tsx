import { Feather } from '@expo/vector-icons';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { AppText } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

/** Un tour : l'offre arrive, le compte à rebours fond, le stock tombe. */
const CYCLE = 5200;

type Props = { size?: number; still?: boolean };

/**
 * LA PROMESSE DU PRODUIT : un prix qui tombe, et qui ne reviendra pas.
 *
 * Cette scène a remplacé « la carte qu'on passe sur le lecteur ». Deux raisons,
 * toutes deux venues de la conduite de projet le 13/08/2026 : **ce matériel ne
 * sera pas réalisé**, et le premier écran doit parler au client — « montrer que
 * l'application sert à obtenir des offres flash, des promotions importantes
 * avec des dates courtes ».
 *
 * On montre donc la carte de l'app, la vraie, en train de vivre : le compte à
 * rebours descend, le stock diminue, la remise pulse. Une capture fixe dirait
 * « il y a des promotions » ; le mouvement dit « ça part MAINTENANT », et c'est
 * toute la différence entre un catalogue et un déstockage.
 */
export function FlashScene({ size = 300, still = false }: Props) {
  const progress = useSharedValue(still ? 0.4 : 0);

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
      accessibilityLabel="Une vente flash : côte de bœuf à 24,90 € au lieu de 34,90 €, il reste quelques pièces et quelques minutes."
      style={{ width: size, height: size }}
      className="items-center justify-center"
    >
      <View
        style={{
          width: size * 0.86,
          borderRadius: size * 0.06,
          backgroundColor: colors.surface,
          overflow: 'hidden',
          shadowColor: '#02120a',
          shadowOpacity: 0.45,
          shadowRadius: size * 0.06,
          shadowOffset: { width: 0, height: size * 0.03 },
          elevation: 14,
        }}
      >
        {/* Le visuel, avec ses trois surimpressions — celles de l'app. */}
        <View style={{ height: size * 0.4, backgroundColor: '#F0DCD2' }}>
          <Countdown progress={progress} size={size} />
          <Discount progress={progress} size={size} />
          <Stock progress={progress} size={size} />
        </View>

        <View style={{ padding: size * 0.045, gap: size * 0.018 }}>
          <AppText className="font-sans-medium text-ink-muted" style={{ fontSize: size * 0.036 }}>
            Maison Hammamet · Empalot
          </AppText>
          <AppText className="font-display text-ink" style={{ fontSize: size * 0.052 }}>
            Côte de bœuf maturée
          </AppText>

          <View className="flex-row items-baseline" style={{ gap: size * 0.025 }}>
            <AppText
              className="font-display"
              style={{ fontSize: size * 0.085, color: colors.danger }}
            >
              24.90€
            </AppText>
            <AppText
              className="font-sans-semibold text-ink-muted line-through"
              style={{ fontSize: size * 0.045, textDecorationColor: colors.danger }}
            >
              34.90€
            </AppText>
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * Le compte à rebours.
 *
 * Le texte est FIXE, et c'est un choix. Le faire défiler seconde par seconde
 * demanderait un rendu React complet chaque seconde — sur le tout premier
 * écran de l'app, pendant que trois scènes tournent déjà. Le mouvement est
 * porté par la pastille elle-même, qui vire au rouge à mi-parcours : l'œil lit
 * « ça se dégrade » sans qu'on paie une horloge.
 */
function Countdown({ progress, size }: { progress: SharedValue<number>; size: number }) {
  const style = useAnimatedStyle(() => ({
    backgroundColor: progress.value > 0.55 ? colors.danger : colors.ink,
  }));

  return (
    <Animated.View
      style={[
        style,
        {
          position: 'absolute',
          top: size * 0.035,
          left: size * 0.035,
          flexDirection: 'row',
          alignItems: 'center',
          gap: size * 0.018,
          borderRadius: size * 0.06,
          paddingHorizontal: size * 0.035,
          paddingVertical: size * 0.018,
        },
      ]}
    >
      <Feather name="clock" size={size * 0.04} color={colors.inkInverse} />
      <AppText className="font-sans-bold text-ink-inverse" style={{ fontSize: size * 0.04 }}>
        11:58
      </AppText>
    </Animated.View>
  );
}

/** La remise, qui bat — le seul élément animé, donc le seul qu'on regarde. */
function Discount({ progress, size }: { progress: SharedValue<number>; size: number }) {
  const style = useAnimatedStyle(() => {
    const beat = interpolate(progress.value, [0, 0.12, 0.24, 1], [1, 1.12, 1, 1]);
    return { transform: [{ scale: beat }] };
  });

  return (
    <Animated.View
      style={[
        style,
        {
          position: 'absolute',
          bottom: size * 0.035,
          left: size * 0.035,
          backgroundColor: colors.brand500,
          borderRadius: size * 0.03,
          paddingHorizontal: size * 0.04,
          paddingVertical: size * 0.018,
        },
      ]}
    >
      <AppText className="font-display text-ink-inverse" style={{ fontSize: size * 0.055 }}>
        -29%
      </AppText>
    </Animated.View>
  );
}

/**
 * Le stock restant.
 *
 * Il apparaît puis s'efface avec le cycle, au lieu de décompter : même raison
 * que pour l'horloge — un chiffre qui change coûte un rendu, et l'apparition
 * suffit à faire lire « il n'en reste presque plus ».
 */
function Stock({ progress, size }: { progress: SharedValue<number>; size: number }) {
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.08, 0.92, 1], [0, 1, 1, 0]),
  }));

  return (
    <Animated.View
      style={[
        style,
        {
          position: 'absolute',
          bottom: size * 0.035,
          right: size * 0.035,
          flexDirection: 'row',
          alignItems: 'center',
          gap: size * 0.015,
          backgroundColor: colors.danger,
          borderRadius: size * 0.06,
          paddingHorizontal: size * 0.035,
          paddingVertical: size * 0.018,
        },
      ]}
    >
      <Feather name="package" size={size * 0.035} color={colors.inkInverse} />
      <AppText className="font-sans-bold text-ink-inverse" style={{ fontSize: size * 0.036 }}>
        Plus que 4
      </AppText>
    </Animated.View>
  );
}
