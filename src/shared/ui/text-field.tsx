import { Feather } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { useColors } from '@/shared/theme/theme-provider';

export type TextFieldProps = TextInputProps & {
  /** Icône à gauche du champ, comme sur les maquettes d'inscription du client. */
  icon?: ComponentProps<typeof Feather>['name'];
  /** Élément à droite (œil du mot de passe, bascule…). */
  accessory?: ReactNode;
  /** Bord rose : le champ est en erreur. */
  invalid?: boolean;
  /** Hauteur réduite (40 px) pour les formulaires qui doivent tenir sur un seul écran. */
  compact?: boolean;
};

/**
 * Le champ de saisie de l'app : fond de carte, filet, icône rose à gauche.
 *
 * Sans `icon`, il reste le champ nu qu'il a toujours été — l'enveloppe ne
 * s'ajoute que lorsqu'il y a quelque chose à y mettre.
 */
export function TextField({
  className,
  icon,
  accessory,
  invalid,
  compact,
  style,
  ...rest
}: TextFieldProps) {
  const colors = useColors();

  const input = (
    <TextInput
      placeholderTextColor={colors.inkFaint}
      className={cn(
        'font-sans text-ink',
        compact ? 'text-sm' : 'text-base',
        icon || accessory ? 'min-w-0 flex-1' : cn('flex-1 px-4', compact ? 'h-10' : 'h-12'),
        !icon && !accessory && 'rounded-control border border-line bg-surface-muted',
        !icon && !accessory && invalid && 'border-brand-500',
        className,
      )}
      style={[{ minWidth: 0 }, style]}
      {...rest}
    />
  );

  if (!icon && !accessory) return input;

  return (
    <View
      className={cn(
        'flex-1 flex-row items-center gap-2.5 rounded-control border bg-surface-muted px-3.5',
        compact ? 'h-10' : 'h-12',
        invalid ? 'border-brand-500' : 'border-line',
      )}
    >
      {icon ? <Feather name={icon} size={17} color={colors.brand500} /> : null}
      <View className="h-full flex-1 justify-center">{input}</View>
      {accessory}
    </View>
  );
}
