import { ActivityIndicator, Pressable, type PressableProps } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { useColors } from '@/shared/theme/theme-provider';

import { AppText } from './text';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'destructive-ghost';
type Size = 'md' | 'sm';

const containerClasses: Record<Variant, string> = {
  primary: 'bg-brand-500 active:bg-brand-600',
  secondary: 'bg-brand-50 active:bg-brand-100',
  // Le bouton « J’ai déjà un compte » des maquettes : un filet rose, pas d’aplat.
  outline: 'border border-brand-500 bg-transparent active:bg-brand-50',
  ghost: 'bg-transparent active:bg-surface-muted',
  destructive: 'bg-danger active:opacity-90',
  // Une action irréversible mais rare (supprimer son compte) : présente, jamais la plus voyante.
  'destructive-ghost': 'bg-transparent active:bg-surface-muted',
};

const labelClasses: Record<Variant, string> = {
  primary: 'text-ink-inverse',
  secondary: 'text-brand-700',
  outline: 'text-brand-600',
  ghost: 'text-brand-600',
  destructive: 'text-ink-inverse',
  'destructive-ghost': 'text-danger',
};

const sizeClasses: Record<Size, string> = {
  md: 'h-12 px-5',
  sm: 'h-9 px-3',
};

export type ButtonProps = Omit<PressableProps, 'children'> & {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
};

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  ...rest
}: ButtonProps) {
  const colors = useColors();
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      className={cn(
        'flex-row items-center justify-center rounded-control',
        containerClasses[variant],
        sizeClasses[size],
        isDisabled && 'opacity-50',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={
            variant === 'primary' || variant === 'destructive'
              ? colors.inkInverse
              : variant === 'destructive-ghost'
                ? colors.danger
                : colors.brand600
          }
        />
      ) : (
        <AppText variant="label" className={cn('text-center', labelClasses[variant])}>
          {label}
        </AppText>
      )}
    </Pressable>
  );
}
