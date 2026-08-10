import { Feather } from '@expo/vector-icons';
import { View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { missionDone, missionRatio, type DailyCounts, type Mission } from '../lib/progression';

type Props = {
  missions: Mission[];
  counts: DailyCounts;
  /**
   * Fond sur lequel la liste est posée. Le bandeau d'accueil est sombre, la
   * carte du hub est claire : sans ce réglage, l'une des deux serait illisible.
   */
  tone?: 'dark' | 'light';
};

/**
 * Les missions du jour, ligne par ligne : l'état, le libellé, l'avancement et
 * l'XP promis. Partagé par le bandeau d'accueil et le hub — une seule mise en
 * forme, donc une seule vérité sur « où j'en suis aujourd'hui ».
 */
export function MissionList({ missions, counts, tone = 'dark' }: Props) {
  const dark = tone === 'dark';

  return (
    <View className="gap-2">
      {missions.map((m) => {
        const ok = missionDone(m, counts);
        return (
          <View key={m.id} testID={`mission-${m.id}`} className="flex-row items-center gap-2.5">
            <Feather
              name={ok ? 'check-circle' : 'circle'}
              size={14}
              color={
                ok
                  ? dark
                    ? colors.lime
                    : colors.brand500
                  : dark
                    ? 'rgba(242,247,240,0.35)'
                    : colors.inkFaint
              }
            />
            <AppText
              className={cn(
                'flex-1',
                dark
                  ? ok
                    ? 'text-ink-inverse/50'
                    : 'text-ink-inverse/85'
                  : ok
                    ? 'text-ink-faint'
                    : 'text-ink',
              )}
              style={{ fontSize: 12.5 }}
              numberOfLines={1}
            >
              {m.label}
            </AppText>
            <View
              className={cn(
                'h-1 w-12 overflow-hidden rounded-pill',
                dark ? 'bg-ink-inverse/15' : 'bg-surface-sunken',
              )}
            >
              <View
                className={cn('h-full rounded-pill', dark ? 'bg-lime' : 'bg-brand-500')}
                style={{ width: `${Math.round(missionRatio(m, counts) * 100)}%` }}
              />
            </View>
            <AppText
              className={cn('font-sans-semibold', dark ? 'text-lime' : 'text-brand-600')}
              style={{ fontSize: 11 }}
            >
              +{m.xp}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}
