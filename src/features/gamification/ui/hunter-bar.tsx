import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import {
  dailyMissions,
  isStreakAlive,
  levelProgress,
  missionDone,
  missionRatio,
  missionsDone,
  nextRank,
  rankOf,
} from '../lib/progression';
import { selectCounts, selectStreak, selectXp, useGameStore } from '../model/store';

type Props = {
  /** Nombre d'offres en dernière chance — l'appel à l'action du jour. */
  criticalCount?: number;
  onPressMissions?: () => void;
};

/**
 * Le bandeau du chasseur : rang, progression, série, missions du jour.
 *
 * C'est lui qui fait la différence entre « une boutique » et « une chasse » :
 * on voit en permanence ce qu'on gagne, où l'on en est, et ce qu'il reste à
 * faire aujourd'hui. Sans cela, rien n'invite à revenir demain.
 */
export function HunterBar({ criticalCount = 0, onPressMissions }: Props) {
  const xp = useGameStore(selectXp);
  const streak = useGameStore(selectStreak);
  const counts = useGameStore(selectCounts);

  // Instant figé au montage : appeler Date.now() pendant le rendu rendrait le
  // composant non idempotent. Les missions du jour ne changent pas en cours de
  // session, ce point de repère suffit donc.
  const [now] = useState(() => Date.now());
  const missions = useMemo(() => dailyMissions(now), [now]);

  const rank = rankOf(xp);
  const next = nextRank(xp);
  const { ratio, toGo } = levelProgress(xp);
  const done = missionsDone(missions, counts);
  const alive = isStreakAlive({ count: streak, lastDay: null }, now) || streak > 0;

  return (
    <View className="mx-5 overflow-hidden rounded-card bg-surface-inverse">
      {/* Rang + série */}
      <View className="flex-row items-center gap-3 px-4 pt-3.5">
        <View className="h-10 w-10 items-center justify-center rounded-pill bg-lime">
          <AppText className="font-display text-forest" style={{ fontSize: 15 }}>
            {rank.level}
          </AppText>
        </View>

        <View className="flex-1">
          <AppText className="font-sans-bold text-ink-inverse" style={{ fontSize: 14 }}>
            {rank.title}
          </AppText>
          <AppText variant="caption" className="text-ink-inverse/60" style={{ fontSize: 11 }}>
            {next ? `${toGo} XP avant ${next.title}` : 'Rang maximal atteint'}
          </AppText>
        </View>

        {streak > 0 ? (
          <View
            className={cn(
              'flex-row items-center gap-1 rounded-pill px-2.5 py-1',
              alive ? 'bg-brand-500' : 'bg-ink-inverse/15',
            )}
          >
            <Feather name="zap" size={12} color={colors.inkInverse} />
            <AppText
              className="font-sans-bold text-ink-inverse"
              style={{ fontSize: 12, fontVariant: ['tabular-nums'] }}
            >
              {streak} j
            </AppText>
          </View>
        ) : null}
      </View>

      {/* Barre de progression */}
      <View className="px-4 pt-2.5">
        <View className="h-1.5 overflow-hidden rounded-pill bg-ink-inverse/15">
          <View
            className="h-full rounded-pill bg-lime"
            style={{ width: `${Math.round(ratio * 100)}%` }}
          />
        </View>
      </View>

      {/* Missions du jour */}
      <Pressable
        testID="hunter-missions"
        accessibilityRole="button"
        accessibilityLabel={`Missions du jour, ${done} sur ${missions.length}`}
        onPress={onPressMissions}
        disabled={!onPressMissions}
        className="mt-3 gap-2 border-t border-ink-inverse/10 px-4 py-3"
      >
        <View className="flex-row items-center justify-between">
          <AppText className="font-sans-semibold text-ink-inverse" style={{ fontSize: 13 }}>
            Missions du jour
          </AppText>
          <AppText
            className="font-sans-bold text-lime"
            style={{ fontSize: 12, fontVariant: ['tabular-nums'] }}
          >
            {done}/{missions.length}
          </AppText>
        </View>

        {missions.map((m) => {
          const ok = missionDone(m, counts);
          return (
            <View key={m.id} className="flex-row items-center gap-2.5">
              <Feather
                name={ok ? 'check-circle' : 'circle'}
                size={14}
                color={ok ? colors.lime : 'rgba(242,247,240,0.35)'}
              />
              <AppText
                className={cn('flex-1', ok ? 'text-ink-inverse/50' : 'text-ink-inverse/85')}
                style={{ fontSize: 12.5 }}
                numberOfLines={1}
              >
                {m.label}
              </AppText>
              <View className="h-1 w-12 overflow-hidden rounded-pill bg-ink-inverse/15">
                <View
                  className="h-full rounded-pill bg-lime"
                  style={{ width: `${Math.round(missionRatio(m, counts) * 100)}%` }}
                />
              </View>
              <AppText className="text-lime" style={{ fontSize: 11 }}>
                +{m.xp}
              </AppText>
            </View>
          );
        })}
      </Pressable>

      {/* L'appel à l'action : ce qui va disparaître */}
      {criticalCount > 0 ? (
        <View className="flex-row items-center gap-2 bg-brand-500 px-4 py-2.5">
          <Feather name="alert-circle" size={14} color={colors.inkInverse} />
          <AppText
            className="flex-1 font-sans-semibold text-ink-inverse"
            style={{ fontSize: 12.5 }}
          >
            {criticalCount} offre{criticalCount > 1 ? 's' : ''} en dernière chance
          </AppText>
        </View>
      ) : null}
    </View>
  );
}
