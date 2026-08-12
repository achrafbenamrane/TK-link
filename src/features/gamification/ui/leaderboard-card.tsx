import { Feather } from '@expo/vector-icons';
import { View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { xpToPassNext, type LeaderRow } from '../lib/leaderboard';

type Props = { rows: LeaderRow[] };

/** Médaille des trois premiers ; au-delà, le rang en chiffres suffit. */
const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

/**
 * Le classement du quartier. Ce n'est pas un palmarès : c'est une CIBLE. La
 * ligne du dessus est toujours à portée, et le pied de carte dit exactement
 * combien d'XP il manque pour la doubler.
 */
export function LeaderboardCard({ rows }: Props) {
  const toPass = xpToPassNext(rows);

  return (
    <View
      testID="hub-leaderboard"
      className="mx-5 overflow-hidden rounded-card border border-line bg-surface"
    >
      {rows.map((r) => (
        <View
          key={r.id}
          testID={`hub-leader-${r.id}`}
          className={cn(
            'flex-row items-center gap-3 border-b border-line px-4 py-2.5',
            r.you && 'bg-brand-50',
          )}
        >
          <AppText
            className={cn(
              'w-6 text-center',
              r.you ? 'font-sans-bold text-brand-700' : 'text-ink-faint',
            )}
            style={{ fontSize: 13, fontVariant: ['tabular-nums'] }}
          >
            {MEDAL[r.rank] ?? r.rank}
          </AppText>
          <AppText
            className={cn(
              'flex-1',
              r.you ? 'font-sans-bold text-ink' : 'font-sans-medium text-ink-muted',
            )}
            style={{ fontSize: 13.5 }}
            numberOfLines={1}
          >
            {r.name}
          </AppText>
          <AppText
            className={cn('font-sans-semibold', r.you ? 'text-brand-600' : 'text-ink-faint')}
            style={{ fontSize: 12.5, fontVariant: ['tabular-nums'] }}
          >
            {r.xp} XP
          </AppText>
        </View>
      ))}

      <View className="flex-row items-center gap-2 px-4 py-3">
        <Feather name="trending-up" size={14} color={colors.brand600} />
        <AppText variant="caption" className="flex-1 text-ink-muted">
          {toPass > 0
            ? `Encore ${toPass} XP pour passer devant.`
            : 'Vous êtes en tête du quartier — tenez la position.'}
        </AppText>
      </View>

      {/* La plateforme n'a pas encore d'utilisateurs : ces voisins sont
          fabriqués. Le dire à l'écran est la seule façon d'éviter qu'une
          démonstration laisse croire à une communauté déjà en place. */}
      <View
        testID="hub-leaderboard-demo"
        className="flex-row items-center gap-2 border-t border-line bg-surface-muted px-4 py-2.5"
      >
        <Feather name="info" size={12} color={colors.inkFaint} />
        <AppText variant="caption" className="flex-1 text-ink-faint" style={{ fontSize: 11.5 }}>
          Voisins simulés — le classement deviendra réel avec les comptes.
        </AppText>
      </View>
    </View>
  );
}
