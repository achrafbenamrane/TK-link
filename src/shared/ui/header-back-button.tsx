import { Feather } from '@expo/vector-icons';
import { Pressable } from 'react-native';

import { useColors } from '@/shared/theme/theme-provider';

/**
 * LE BOUTON RETOUR, dessiné une seule fois : un rond de 40 px, filet et fond de carte, chevron.
 *
 * Chaque écran dessinait le sien — flèche nue de 24 px ici, chevron nu de 26 px là, rond gris
 * ailleurs — et la flèche ne tombait jamais au même endroit d'un écran à l'autre (retour du
 * 13/11/2026 : « rien n'est aligné »). La navigation reste à l'appelant.
 */
export function HeaderBackButton({
  onPress,
  testID,
  accessibilityLabel = 'Retour',
}: {
  onPress: () => void;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      onPress={onPress}
      className="h-10 w-10 items-center justify-center rounded-pill border border-line bg-surface-muted active:opacity-70"
    >
      <Feather name="chevron-left" size={20} color={colors.ink} />
    </Pressable>
  );
}
