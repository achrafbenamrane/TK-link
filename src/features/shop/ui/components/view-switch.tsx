import { Feather } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

export type HomeView = 'liste' | 'carte';

type Props = {
  value: HomeView;
  onChange: (value: HomeView) => void;
  /** Version en ligne dans l'en-tête (maquette B) : plus petite, sans pleine largeur. */
  compact?: boolean;
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
export function ViewSwitch({ value, onChange, compact = false }: Props) {
  const colors = useColors();
  return (
    <View
      accessibilityRole="tablist"
      // Pleine largeur, et les deux moitiés à parts égales. Le sélecteur était
      // coincé à droite d'un en-tête déjà chargé, entre l'identité et deux
      // autres boutons : « on ne le remarque pas ». Il occupe désormais sa
      // propre ligne, et sa largeur lui vaut d'être vu.
      className={cn(
        'flex-row rounded-pill border border-line bg-surface-muted',
        compact ? 'p-0.5' : 'w-full p-1',
      )}
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
              'flex-row items-center justify-center rounded-pill',
              compact ? 'gap-1 px-2.5 py-1.5' : 'flex-1 gap-1.5 px-3.5 py-2',
              active && 'border border-brand-500 bg-brand-50',
            )}
          >
            <Feather
              name={option.icon}
              size={compact ? 13 : 15}
              color={active ? colors.brand600 : colors.inkMuted}
            />
            <AppText
              className={cn(
                compact ? 'text-xs' : 'text-sm',
                active ? 'font-sans-bold text-brand-600' : 'font-sans-medium text-ink-muted',
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
