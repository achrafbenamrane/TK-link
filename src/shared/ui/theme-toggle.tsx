import { Feather } from '@expo/vector-icons';
import { Pressable, useColorScheme, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { resolveScheme, useColors } from '@/shared/theme/theme-provider';
import { selectThemeMode, useThemeStore } from '@/shared/theme/theme-store';

import { AppText } from './text';

const OPTIONS = [
  { key: 'night', label: 'Nuit', icon: 'moon' },
  { key: 'day', label: 'Jour', icon: 'sun' },
] as const;

/**
 * La bascule « Nuit / Jour » des maquettes du client.
 *
 * Deux options toujours visibles, l'active teintée de rose : on voit dans quel
 * mode on est et ce que le tap va faire. Choisir l'une ou l'autre fixe le mode
 * (il ne suit plus le téléphone) ; le réglage est conservé d'un lancement à
 * l'autre.
 */
export function ThemeToggle({ testID = 'theme-toggle' }: { testID?: string }) {
  const colors = useColors();
  const mode = useThemeStore(selectThemeMode);
  const setMode = useThemeStore((s) => s.setMode);
  const system = useColorScheme();
  // En mode « système », on met en avant ce que le téléphone impose.
  const current = resolveScheme(mode, system) === 'day' ? 'day' : 'night';

  return (
    <View
      testID={testID}
      accessibilityRole="tablist"
      className="flex-row rounded-pill border border-line bg-surface-muted p-0.5"
    >
      {OPTIONS.map((option) => {
        const active = current === option.key;
        return (
          <Pressable
            key={option.key}
            testID={`${testID}-${option.key}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Mode ${option.label.toLowerCase()}`}
            hitSlop={6}
            onPress={() => setMode(option.key)}
            className={cn(
              'flex-row items-center gap-1 rounded-pill px-2 py-1',
              active && 'border border-brand-500 bg-brand-50',
            )}
          >
            <Feather
              name={option.icon}
              size={12}
              color={active ? colors.brand600 : colors.inkFaint}
            />
            <AppText
              className={cn(
                'text-xs',
                active ? 'font-sans-bold text-brand-600' : 'font-sans-medium text-ink-faint',
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
