import { Feather } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { AppText } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

type Props = {
  qty: number;
  onInc: () => void;
  onDec: () => void;
  testID?: string;
};

export function QtyStepper({ qty, onInc, onDec, testID }: Props) {
  return (
    <View
      testID={testID}
      className="flex-row items-center gap-3 rounded-pill border border-line bg-surface px-1.5 py-1"
    >
      <Pressable
        onPress={onDec}
        hitSlop={6}
        accessibilityLabel="Diminuer la quantité"
        className="h-7 w-7 items-center justify-center rounded-pill bg-surface-muted active:bg-surface-sunken"
      >
        <Feather name="minus" size={15} color={colors.ink} />
      </Pressable>
      <AppText className="min-w-[18px] text-center font-sans-bold">{qty}</AppText>
      <Pressable
        onPress={onInc}
        hitSlop={6}
        accessibilityLabel="Augmenter la quantité"
        className="h-7 w-7 items-center justify-center rounded-pill bg-ink active:bg-ink-muted"
      >
        <Feather name="plus" size={15} color={colors.inkInverse} />
      </Pressable>
    </View>
  );
}
