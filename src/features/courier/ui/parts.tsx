import { Feather } from '@expo/vector-icons';
import { useRef, type ReactNode } from 'react';
import { Linking, Pressable, TextInput, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText, ThemeToggle, Wordmark } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

/** Un résultat d'authentification biométrique, tel que le système le rend. */
export type BiometricResult =
  { ok: true } | { ok: false; reason: 'annule' | 'echec' | 'indisponible' };

/** « 14:32 » */
export const clock = (ms: number): string => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
};

/**
 * L'en-tête des écrans de mission, comme sur la maquette : retour, logo, Nuit/Jour, puis le
 * titre de l'écran et l'étiquette d'état (« En cours », « En route client »).
 */
export function CourierHeader({
  title,
  badge,
  onBack,
}: {
  title: string;
  badge?: string;
  onBack?: () => void;
}) {
  const colors = useColors();
  return (
    <View className="gap-3 pt-2">
      <View className="flex-row items-center justify-between">
        <View className="w-9">
          {onBack ? (
            <Pressable
              testID="courier-back"
              accessibilityRole="button"
              accessibilityLabel="Retour"
              hitSlop={10}
              onPress={onBack}
            >
              <Feather name="arrow-left" size={22} color={colors.ink} />
            </Pressable>
          ) : null}
        </View>
        <Wordmark size={22} />
        <ThemeToggle />
      </View>
      <View className="flex-row items-center justify-between">
        <AppText variant="title" className="text-base">
          {title}
        </AppText>
        {badge ? (
          <View className="rounded-pill border border-brand-500 px-3 py-1">
            <AppText
              testID="courier-badge"
              className="font-sans-semibold text-brand-600"
              style={{ fontSize: 11.5 }}
            >
              {badge}
            </AppText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Le bouton rond « téléphone » : ouvre le composeur du téléphone. */
export function PhoneButton({ phone, label }: { phone?: string | undefined; label: string }) {
  const colors = useColors();
  if (!phone) return null;
  return (
    <Pressable
      testID={`courier-call-${label}`}
      accessibilityRole="button"
      accessibilityLabel={`Appeler ${label}`}
      hitSlop={8}
      onPress={() => {
        void Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`).catch(() => undefined);
      }}
      className="h-10 w-10 items-center justify-center rounded-pill border border-brand-500 bg-brand-50"
    >
      <Feather name="phone" size={17} color={colors.brand500} />
    </Pressable>
  );
}

/** Un bloc de la maquette : fond de carte, filet fin, titre discret. */
export function Panel({
  title,
  right,
  children,
  className,
  testID,
}: {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  testID?: string;
}) {
  return (
    <View
      testID={testID}
      className={cn('gap-2.5 rounded-card border border-line bg-surface p-3.5', className)}
    >
      {title ? (
        <View className="flex-row items-center justify-between">
          <AppText variant="caption" className="font-sans-semibold text-ink-muted">
            {title}
          </AppText>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/**
 * Un code à N chiffres affiché en cases, saisi au clavier numérique. Un seul champ invisible
 * porte la saisie : les cases ne sont que son reflet, ce qui garde le collage et la saisie
 * semi-automatique du téléphone.
 */
export function CodeBoxes({
  value,
  onChange,
  length,
  testID,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  length: number;
  testID: string;
  label: string;
}) {
  const ref = useRef<TextInput>(null);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => ref.current?.focus()}
      className="flex-row justify-between gap-1.5"
    >
      {Array.from({ length }, (_, i) => (
        <View
          key={i}
          className={cn(
            'h-11 flex-1 items-center justify-center rounded-control border bg-surface-muted',
            value.length === i ? 'border-brand-500' : 'border-line',
          )}
        >
          <AppText className="font-display text-ink" style={{ fontSize: 20 }}>
            {value[i] ?? '–'}
          </AppText>
        </View>
      ))}
      <TextInput
        ref={ref}
        testID={testID}
        value={value}
        onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, length))}
        keyboardType="number-pad"
        maxLength={length}
        accessibilityLabel={label}
        // Invisible mais focalisable : il reçoit la saisie que les cases reflètent.
        style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%' }}
      />
    </Pressable>
  );
}
