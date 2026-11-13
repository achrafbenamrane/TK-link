import { useEffect, useState } from 'react';
import { Platform, Text, TextInput, type TextStyle } from 'react-native';
import Animated, {
  type SharedValue,
  useAnimatedProps,
  useAnimatedReaction,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { cn } from '@/shared/lib/cn';

/**
 * Le temps restant à l’instant `now` : jusqu’à `endsAt` s’il est connu (> 0), sinon `totalMs` en
 * boucle depuis `start`. Pur, pour être testé hors du fil d’interface.
 */
export function remainingMsAt(now: number, start: number, totalMs: number, endsAt: number): number {
  'worklet';
  if (endsAt > 0) return Math.max(0, endsAt - now);
  if (totalMs <= 0) return 0;
  return totalMs - (Math.max(0, now - start) % totalMs);
}

/**
 * Le temps restant d’un compte à rebours, en millisecondes, tenu sur le fil d’interface.
 *
 * Le rapport d’avancement remis au client annonce les dixièmes et les centièmes de seconde : un
 * affichage qui change soixante fois par seconde. Fait par un `setState` côté JavaScript, chaque
 * carte de l’accueil re-rendrait React soixante fois par seconde — c’est exactement la « boucle sur
 * le fil JS » que le projet interdit. Ici, une seule valeur partagée avance à chaque image ; les
 * textes qui en dépendent se mettent à jour sans React (`TickingText`).
 *
 * - `endsAt` (horodatage en ms) : une vraie Flash ; le décompte s’arrête à zéro, pour de bon.
 * - sinon : `seconds` en boucle — les offres d’exemple, écrites en dur, ne doivent pas laisser une
 *   carte morte à l’écran pendant une présentation.
 */

export function useRemainingMs(seconds: number, endsAt?: number | undefined): SharedValue<number> {
  const totalMs = Math.max(0, seconds * 1000);
  const remaining = useSharedValue(totalMs);
  const start = useSharedValue(0);
  const total = useSharedValue(totalMs);
  const end = useSharedValue(endsAt ?? 0);

  useEffect(() => {
    total.set(totalMs);
    end.set(endsAt ?? 0);
    // L'horloge part du montage (ou d'une nouvelle durée) : `Date.now()` hors du rendu.
    start.set(Date.now());
  }, [totalMs, endsAt, total, end, start]);

  useFrameCallback(() => {
    'worklet';
    const s = start.get();
    if (s === 0) return;
    const left = remainingMsAt(Date.now(), s, total.get(), end.get());
    if (left !== remaining.get()) remaining.set(left);
  });

  return remaining;
}

/** Les secondes entières restantes, relayées à React une fois par seconde (étiquette d’accessibilité). */
export function useRemainingSeconds(remaining: SharedValue<number>): number {
  const [seconds, setSeconds] = useState(() => Math.floor(remaining.get() / 1000));
  useAnimatedReaction(
    () => Math.floor(remaining.get() / 1000),
    (now, previous) => {
      if (now !== previous) scheduleOnRN(setSeconds, now);
    },
  );
  return seconds;
}

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

export type TickingTextProps = {
  remaining: SharedValue<number>;
  /** Fonction `'worklet'` : le temps restant (ms) → le texte. Longueur constante attendue. */
  format: (remainingMs: number) => string;
  className?: string;
  style?: TextStyle;
  testID?: string;
};

/**
 * Un texte qui suit une valeur partagée image par image, sans re-rendu React.
 *
 * Sur iOS et Android, c’est un champ en lecture seule dont Reanimated réécrit le texte depuis le fil
 * d’interface (la technique dite « ReText »). Sa largeur est mesurée sur le premier texte : le format
 * DOIT garder une longueur constante (chiffres tabulaires). Sur le web (aperçu seulement), un champ
 * `<input>` prend une largeur par défaut qui casserait les pastilles : on y suit la même valeur avec
 * un simple texte.
 *
 * Masqué aux lecteurs d’écran : le parent porte l’étiquette, mise à jour à la seconde — annoncer les
 * centièmes n’aurait aucun sens.
 */
export function TickingText(props: TickingTextProps) {
  return Platform.OS === 'web' ? <WebTickingText {...props} /> : <NativeTickingText {...props} />;
}

function NativeTickingText({ remaining, format, className, style, testID }: TickingTextProps) {
  const animatedProps = useAnimatedProps(() => {
    const text = format(remaining.get());
    // `text` n'est pas dans les types de TextInput : c'est la prop native que Reanimated réécrit.
    return { text, defaultValue: text } as unknown as Partial<{ defaultValue: string }>;
  });

  return (
    <AnimatedTextInput
      testID={testID}
      className={cn('p-0', className)}
      style={[{ fontVariant: ['tabular-nums'], flexShrink: 0 }, style]}
      editable={false}
      caretHidden
      contextMenuHidden
      scrollEnabled={false}
      underlineColorAndroid="transparent"
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no"
      defaultValue={format(remaining.get())}
      animatedProps={animatedProps}
    />
  );
}

function WebTickingText({ remaining, format, className, style, testID }: TickingTextProps) {
  const [text, setText] = useState(() => format(remaining.get()));
  useAnimatedReaction(
    () => format(remaining.get()),
    (now, previous) => {
      if (now !== previous) scheduleOnRN(setText, now);
    },
  );
  return (
    <Text
      testID={testID}
      className={className}
      style={[{ fontVariant: ['tabular-nums'], flexShrink: 0 }, style]}
      accessible={false}
      importantForAccessibility="no"
    >
      {text}
    </Text>
  );
}
