import { Feather } from '@expo/vector-icons';
import { View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import type { Badge } from '../lib/badges';

type Props = { badges: Badge[] };

/**
 * Le mur des trophées. Les verrouillés restent VISIBLES, avec leur condition :
 * une grille qui ne montrerait que l'acquis ne donnerait aucun objectif — et
 * c'est l'objectif, pas la médaille, qui fait revenir.
 */
export function BadgesGrid({ badges }: Props) {
  return (
    <View testID="hub-badges" className="mx-5 flex-row flex-wrap gap-2">
      {badges.map((b) => (
        <View
          key={b.id}
          testID={`hub-badge-${b.id}`}
          accessibilityLabel={b.earned ? `${b.label}, obtenu` : `${b.label}, ${b.hint}`}
          className={cn(
            'w-[31%] items-center gap-1 rounded-card border p-3',
            b.earned ? 'border-brand-200 bg-brand-50' : 'border-line bg-surface-muted',
          )}
        >
          <View
            className={cn(
              'h-9 w-9 items-center justify-center rounded-pill',
              b.earned ? 'bg-brand-500' : 'bg-surface-sunken',
            )}
          >
            <Feather
              name={b.earned ? b.icon : 'lock'}
              size={16}
              color={b.earned ? colors.inkInverse : colors.inkFaint}
            />
          </View>
          <AppText
            className={cn(
              'text-center font-sans-semibold',
              b.earned ? 'text-ink' : 'text-ink-faint',
            )}
            style={{ fontSize: 11 }}
            numberOfLines={1}
          >
            {b.label}
          </AppText>
          <AppText
            variant="caption"
            className="text-center text-ink-faint"
            style={{ fontSize: 9.5, lineHeight: 12 }}
            numberOfLines={2}
          >
            {b.earned ? 'Obtenu' : b.hint}
          </AppText>
        </View>
      ))}
    </View>
  );
}
