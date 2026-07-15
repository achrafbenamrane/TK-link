import { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, ScrollView } from 'react-native';

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

export function CategoryBar({ value, onChange }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2 px-5 py-1"
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
            className={cn(
              'flex-row items-center gap-1.5 rounded-pill border px-4 py-2',
              active ? 'border-ink bg-ink' : 'border-line bg-surface',
            )}
          >
            <Feather
              name={item.icon}
              size={14}
              color={active ? colors.inkInverse : colors.inkMuted}
            />
            <AppText
              className={cn(
                'font-sans-semibold text-sm',
                active ? 'text-ink-inverse' : 'text-ink-muted',
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
