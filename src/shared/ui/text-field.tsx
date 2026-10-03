import { TextInput, type TextInputProps } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { useColors } from '@/shared/theme/theme-provider';

export type TextFieldProps = TextInputProps;

export function TextField({ className, ...rest }: TextFieldProps) {
  const colors = useColors();
  return (
    <TextInput
      placeholderTextColor={colors.inkFaint}
      className={cn(
        'h-12 flex-1 rounded-control border border-ink-faint/30 bg-surface-muted px-4 font-sans text-base text-ink',
        className,
      )}
      {...rest}
    />
  );
}
