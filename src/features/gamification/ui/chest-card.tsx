import { Feather } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import type { ChestReward } from '../lib/chest';

type Props = {
  /** Le coffre du jour est-il encore fermé ? */
  available: boolean;
  /** Le dernier coffre ouvert — affiché tant que le suivant n'est pas dispo. */
  last: ChestReward | null;
  onOpen: () => void;
};

/** Couleur de la pastille selon le palier — l'or doit se voir de loin. */
const TIER_COLOR: Record<ChestReward['tier'], string> = {
  bronze: '#C98A4B',
  argent: '#C9CFC6',
  or: colors.lime,
};

/**
 * Le coffre du jour.
 *
 * Fermé, il respire (échelle + bascule légère) : un objet immobile ne demande
 * pas qu'on le touche. Ouvert, il ne se contente pas de disparaître — il
 * MONTRE ce qu'il a donné, sinon la récompense se perd dans un total d'XP que
 * personne ne regarde.
 */
export function ChestCard({ available, last, onOpen }: Props) {
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!available || reduced) {
      pulse.value = 0;
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [available, reduced, pulse]);

  const chestStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.08 }, { rotate: `${(pulse.value - 0.5) * 6}deg` }],
  }));

  return (
    <View
      testID="hub-chest"
      className="mx-5 overflow-hidden rounded-card bg-forest-deep p-4"
      accessibilityLabel={available ? 'Coffre du jour à ouvrir' : 'Coffre du jour déjà ouvert'}
    >
      <View className="flex-row items-center gap-3.5">
        <Animated.View
          style={chestStyle}
          className="h-14 w-14 items-center justify-center rounded-control bg-lime"
        >
          <Feather name="gift" size={26} color={colors.forestDeep} />
        </Animated.View>

        <View className="flex-1">
          <AppText className="font-display text-ink-inverse" style={{ fontSize: 15 }}>
            Coffre du jour
          </AppText>
          {available ? (
            <AppText variant="caption" className="mt-0.5 text-ink-inverse/70">
              Un cadeau vous attend — points et XP, tous les jours.
            </AppText>
          ) : last ? (
            <View className="mt-1 flex-row items-center gap-2">
              <View
                className="rounded-pill px-2 py-0.5"
                style={{ backgroundColor: TIER_COLOR[last.tier] }}
              >
                <AppText className="font-sans-bold text-forest-deep" style={{ fontSize: 10 }}>
                  {last.label.toUpperCase()}
                </AppText>
              </View>
              <AppText variant="caption" className="text-ink-inverse/70">
                +{last.xp} XP · +{last.points} points
              </AppText>
            </View>
          ) : null}
        </View>
      </View>

      {available ? (
        <Pressable
          testID="hub-chest-open"
          accessibilityRole="button"
          accessibilityLabel="Ouvrir le coffre du jour"
          onPress={onOpen}
          className="mt-3.5 flex-row items-center justify-center gap-2 rounded-control bg-lime py-3 active:opacity-85"
        >
          <Feather name="unlock" size={15} color={colors.forestDeep} />
          <AppText className="font-sans-bold text-forest-deep">Ouvrir mon coffre</AppText>
        </Pressable>
      ) : (
        <View className="mt-3.5 flex-row items-center justify-center gap-2 rounded-control bg-ink-inverse/10 py-3">
          <Feather name="clock" size={14} color={colors.inkInverse} />
          <AppText className="font-sans-semibold text-ink-inverse/70" style={{ fontSize: 13 }}>
            Prochain coffre demain
          </AppText>
        </View>
      )}
    </View>
  );
}
