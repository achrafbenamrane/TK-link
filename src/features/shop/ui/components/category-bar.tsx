import { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { CATEGORY_INFO } from '@/shared/lib/categories';

import { CATEGORIES, CATEGORY_LABELS, type Category } from '../../model/schema';

type FeatherName = ComponentProps<typeof Feather>['name'];

/**
 * `shared/lib` décrit l'icône par son nom, en `string` : une table de domaine
 * n'a pas à dépendre des types d'une librairie de rendu. La conversion se fait
 * donc ici, au seul endroit qui connaît Feather.
 */
const iconOf = (c: Category): FeatherName => CATEGORY_INFO[c].icon as FeatherName;

type Item = { key: Category | null; label: string; icon: FeatherName };

const ITEMS: Item[] = [
  { key: null, label: 'Tous', icon: 'grid' },
  ...CATEGORIES.map((c) => ({ key: c, label: CATEGORY_LABELS[c], icon: iconOf(c) })),
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
      // `flexGrow: 0` est indispensable : un ScrollView horizontal placé dans
      // une colonne flex s'étire verticalement pour occuper toute la hauteur
      // libre. En vue liste ça ne se voyait pas (il est dans l'en-tête d'une
      // FlatList, qui ne l'étire pas) ; en vue carte il mangeait la moitié de
      // l'écran et écrasait la carte en bas.
      style={{ flexGrow: 0 }}
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
            className="w-[76px] items-center gap-1.5 active:opacity-70"
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
