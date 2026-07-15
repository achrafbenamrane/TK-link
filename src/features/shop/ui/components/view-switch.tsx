import { Feather } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

export type HomeView = 'liste' | 'carte';

type Props = {
  value: HomeView;
  onChange: (value: HomeView) => void;
};

const OPTIONS: { key: HomeView; label: string; icon: 'list' | 'map' }[] = [
  { key: 'liste', label: 'Liste', icon: 'list' },
  { key: 'carte', label: 'Carte', icon: 'map' },
];

/**
 * Bascule liste ⇄ carte de l'accueil. Segmenté plutôt qu'un simple bouton :
 * les deux états sont visibles en permanence, donc on sait toujours où l'on est
 * et ce qui se passera au tap — un bouton unique oblige à deviner.
 */
export function ViewSwitch({ value, onChange }: Props) {
  return (
    <View
      accessibilityRole="tablist"
      className="flex-row rounded-pill border border-line bg-surface-muted p-1"
    >
      {OPTIONS.map((option) => {
        const active = value === option.key;
        return (
          <Pressable
            key={option.key}
            testID={`home-view-${option.key}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Afficher en ${option.label.toLowerCase()}`}
            onPress={() => onChange(option.key)}
            className={cn(
              'flex-row items-center gap-1.5 rounded-pill px-3.5 py-1.5',
              active && 'bg-ink',
            )}
          >
            <Feather
              name={option.icon}
              size={14}
              color={active ? colors.inkInverse : colors.inkMuted}
            />
            <AppText
              className={cn(
                'text-xs',
                active ? 'font-sans-bold text-ink-inverse' : 'font-sans-medium text-ink-muted',
              )}
            >
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
