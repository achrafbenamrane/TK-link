import { Feather } from '@expo/vector-icons';
import { View } from 'react-native';

import { useColors } from '@/shared/theme/theme-provider';

import { AppText } from './text';
import { Button } from './button';
import { Screen } from './screen';

export type ErrorScreenProps = {
  /** Relance l'écran qui a planté. */
  onRetry: () => void;
  /**
   * Le message technique, montré seulement en développement : un client n'a rien à faire d'une trace,
   * et elle peut contenir ce qu'il vient de saisir.
   */
  detail?: string | undefined;
};

/**
 * L'ÉCRAN D'ERREUR — ce que voit l'utilisateur quand un écran plante, à la place d'un écran blanc.
 *
 * Il dit que ce n'est pas sa faute, que ses données sont gardées sur le téléphone, et lui laisse un
 * seul geste : réessayer.
 */
export function ErrorScreen({ onRetry, detail }: ErrorScreenProps) {
  const colors = useColors();
  return (
    <Screen testID="error-screen">
      <View className="flex-1 items-center justify-center gap-4 px-4">
        <View className="h-20 w-20 items-center justify-center rounded-pill border-2 border-brand-500">
          <Feather name="alert-triangle" size={34} color={colors.brand500} />
        </View>
        <AppText variant="display" className="text-center text-2xl">
          Un souci est survenu
        </AppText>
        <AppText variant="caption" className="text-center">
          L’application a rencontré une erreur. Ce n’est pas de votre faute, et vos données restent
          sur votre téléphone.
        </AppText>
        {detail ? (
          <AppText
            testID="error-detail"
            variant="caption"
            className="text-center text-ink-faint"
            numberOfLines={4}
          >
            {detail}
          </AppText>
        ) : null}
        <View className="w-full">
          <Button testID="error-retry" label="Réessayer" onPress={onRetry} />
        </View>
      </View>
    </Screen>
  );
}
