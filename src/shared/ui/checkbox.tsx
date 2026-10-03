import { Feather } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { useColors } from '@/shared/theme/theme-provider';

export type CheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Le libellé — texte ou fragments (un lien vers les CGU, par exemple). */
  children: ReactNode;
  accessibilityLabel: string;
  testID?: string;
  /** Bord rose : la case est exigée et n'est pas cochée. */
  invalid?: boolean;
};

/**
 * Case à cocher — « J'accepte les CGU et la politique de confidentialité ».
 *
 * Toute la ligne est cliquable : viser un carré de 20 px au pouce est le genre
 * de détail qui fait abandonner un formulaire. Le libellé reste libre pour y
 * loger des liens.
 */
export function Checkbox({
  checked,
  onChange,
  children,
  accessibilityLabel,
  testID,
  invalid,
}: CheckboxProps) {
  const colors = useColors();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
      onPress={() => onChange(!checked)}
      className="flex-row items-start gap-2.5"
    >
      <View
        className={cn(
          'mt-0.5 h-5 w-5 items-center justify-center rounded-md border',
          checked ? 'border-brand-500 bg-brand-500' : invalid ? 'border-brand-500' : 'border-line',
        )}
      >
        {checked ? <Feather name="check" size={13} color={colors.inkInverse} /> : null}
      </View>
      <View className="flex-1">{children}</View>
    </Pressable>
  );
}
