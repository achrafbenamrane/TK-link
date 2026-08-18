import { Feather } from '@expo/vector-icons';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { CATEGORY_INFO } from '@/shared/lib/categories';
import { AppText } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

/** Un tour : le radar balaie une fois. */
const CYCLE = 5200;

const LIME_VEIL = 'rgba(195, 245, 60, 0.16)';
const LIME_EDGE = 'rgba(195, 245, 60, 0.28)';
const LIME_RING = 'rgba(195, 245, 60, 0.55)';
const INK_VEIL = 'rgba(242, 247, 240, 0.12)';
const INK_SOFT = 'rgba(242, 247, 240, 0.62)';

/**
 * Les catégories montrées, tirées de `CATEGORY_INFO` — pas réinventées ici.
 *
 * Les deux premières sont CHOISIES, la troisième ne l'est pas : c'est ce qui
 * fait comprendre qu'il s'agit d'une sélection personnelle et non d'un menu.
 * Trois vignettes toutes allumées ne diraient rien.
 */
const CHIPS = [
  { key: 'restauration', picked: true },
  { key: 'high-tech', picked: true },
  { key: 'mode', picked: false },
] as const;

/**
 * Les offres autour de soi, placées en fractions du radar depuis son centre.
 * Des distances différentes : un semis régulier ressemblerait à un cadran
 * d'horloge, pas à un quartier.
 */
const PINS = [
  { emoji: '🥐', x: 0.3, y: -0.2 },
  { emoji: '👗', x: -0.28, y: 0.08 },
  { emoji: '📱', x: 0.12, y: 0.28 },
] as const;

type Props = { size?: number; still?: boolean };

/**
 * DEUXIÈME PANNEAU : des offres CHOISIES, et à côté de chez soi.
 *
 * Il remplace « La Chasse », retirée le 18/08 sur demande de la conduite de
 * projet : deux panneaux sur trois parlaient de jeux, alors que l'app sert à
 * obtenir des promotions sur un temps court. Un seul panneau ludique suffit.
 *
 * Celui-ci dit les deux moitiés de la promesse en une image : les catégories
 * qu'on a choisies — deux allumées, une éteinte, donc une sélection — et les
 * offres qui tombent AUTOUR de soi, révélées par un radar.
 *
 * Les vignettes d'offres sont PERMANENTES. Les faire apparaître puis
 * disparaître les ferait clignoter au raccord de boucle : c'est exactement la
 * faute corrigée la veille sur la scène des prix, on ne la refait pas.
 */
export function NearbyScene({ size = 300, still = false }: Props) {
  const progress = useSharedValue(still ? 0.45 : 0);

  useEffect(() => {
    if (still) return;
    progress.value = withRepeat(
      withTiming(1, { duration: CYCLE, easing: Easing.linear }),
      -1,
      false,
    );
  }, [progress, still]);

  const radar = size * 0.46;

  return (
    <View
      testID="welcome-nearby"
      accessible
      accessibilityRole="image"
      accessibilityLabel="Vos catégories préférées, et les offres flash disponibles autour de vous."
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
          gap: size * 0.045,
          alignItems: 'center',
          shadowColor: '#000000',
          shadowOpacity: 0.5,
          shadowRadius: size * 0.055,
          shadowOffset: { width: 0, height: size * 0.028 },
          elevation: 12,
        }}
      >
        {/* ── Le radar : moi au centre, les offres autour ── */}
        <View style={{ width: radar, height: radar }} className="items-center justify-center">
          <Ring progress={progress} radar={radar} phase={0} />
          <Ring progress={progress} radar={radar} phase={0.34} />
          <Ring progress={progress} radar={radar} phase={0.67} />

          {/* Moi. Le point bleu de toutes les cartes, en vert de marque. */}
          <View
            className="items-center justify-center"
            style={{
              width: radar * 0.2,
              height: radar * 0.2,
              borderRadius: radar * 0.1,
              backgroundColor: colors.lime,
            }}
          >
            <Feather name="user" size={radar * 0.11} color={colors.forestDeep} />
          </View>

          {PINS.map((p) => (
            <View
              key={p.emoji}
              className="items-center justify-center"
              style={{
                position: 'absolute',
                left: radar / 2 + p.x * radar - radar * 0.11,
                top: radar / 2 + p.y * radar - radar * 0.11,
                width: radar * 0.22,
                height: radar * 0.22,
                borderRadius: radar * 0.11,
                borderWidth: 1,
                borderColor: LIME_EDGE,
                backgroundColor: colors.forestDeep,
              }}
            >
              <AppText style={{ fontSize: radar * 0.11 }}>{p.emoji}</AppText>
            </View>
          ))}
        </View>

        {/* ── Ce que j'ai choisi ── */}
        <View className="flex-row flex-wrap justify-center" style={{ gap: size * 0.025 }}>
          {CHIPS.map((c) => (
            <View
              key={c.key}
              className="flex-row items-center"
              style={{
                gap: size * 0.018,
                borderRadius: size * 0.05,
                paddingHorizontal: size * 0.032,
                paddingVertical: size * 0.018,
                backgroundColor: c.picked ? LIME_VEIL : INK_VEIL,
                borderWidth: 1,
                borderColor: c.picked ? LIME_EDGE : 'transparent',
              }}
            >
              <AppText style={{ fontSize: size * 0.03 }}>{CATEGORY_INFO[c.key].emoji}</AppText>
              <AppText
                className="font-sans-bold"
                style={{ fontSize: size * 0.03, color: c.picked ? colors.lime : INK_SOFT }}
              >
                {CATEGORY_INFO[c.key].short}
              </AppText>
              {c.picked ? <Feather name="check" size={size * 0.03} color={colors.lime} /> : null}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/**
 * Une onde du radar.
 *
 * `phase` décale les trois anneaux pour qu'ils se suivent. Le calcul repart à
 * zéro à chaque tour (modulo 1) et l'opacité vaut zéro AUX DEUX BOUTS : sans
 * cela, l'anneau réapparaîtrait brutalement à pleine intensité au raccord.
 */
function Ring({
  progress,
  radar,
  phase,
}: {
  progress: SharedValue<number>;
  radar: number;
  phase: number;
}) {
  const style = useAnimatedStyle(() => {
    const t = (progress.value + phase) % 1;
    return {
      opacity: interpolate(t, [0, 0.12, 1], [0, 0.6, 0], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(t, [0, 1], [0.24, 1], Extrapolation.CLAMP) }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        style,
        {
          position: 'absolute',
          width: radar,
          height: radar,
          borderRadius: radar / 2,
          borderWidth: 1.5,
          borderColor: LIME_RING,
        },
      ]}
    />
  );
}
