import { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { CATEGORIES, CATEGORY_LABELS, type Category } from '../../model/schema';

type FeatherName = ComponentProps<typeof Feather>['name'];

const ICONS: Record<Category | 'tous', FeatherName> = {
  tous: 'grid',
  restos: 'coffee',
  artisans: 'award',
  courses: 'shopping-bag',
  shopping: 'gift',
};

type Item = { key: Category | null; label: string; icon: FeatherName };

const ITEMS: Item[] = [
  { key: null, label: 'Tous', icon: ICONS.tous },
  ...CATEGORIES.map((c) => ({ key: c, label: CATEGORY_LABELS[c], icon: ICONS[c] })),
];

type Props = {
  value: Category | null;
  onChange: (value: Category | null) => void;
};

/**
 * Category filter: a rounded icon tile with the label stacked underneath.
 * Resting state is a red line icon on cream; the selected tile inverts to
 * solid red so the current filter reads at a glance while scrolling.
 */
export function CategoryBar({ value, onChange }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-3 px-5 py-1"
    >
      {ITEMS.map((item) => {
        const active = value === item.key;
        return (
          <Pressable
            key={item.label}
            testID={`cat-${item.key ?? 'tous'}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(item.key)}
            className="w-[68px] items-center gap-1.5 active:opacity-70"
          >
            <View
              className={cn(
                'h-14 w-14 items-center justify-center rounded-card border',
                active ? 'border-brand-500 bg-brand-500' : 'border-line bg-surface-muted',
              )}
            >
              <Feather
                name={item.icon}
                size={22}
                color={active ? colors.inkInverse : colors.brand500}
              />
            </View>
            <AppText
              numberOfLines={1}
              className={cn(
                'text-xs',
                active ? 'font-sans-bold text-ink' : 'font-sans-medium text-ink-muted',
              )}
            >
              {item.label}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
