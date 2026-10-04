import { Feather } from '@expo/vector-icons';
import { View } from 'react-native';

import { AppText, Button, Screen } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

import type { SupplierStatus } from '../lib/supplier';

/**
 * Ce que voit un fournisseur dont le compte n'est pas encore validé, à la place de la
 * publication d'offres : l'étape 6 du schéma (« compte validé ») ouvre le tableau de bord
 * et la publication, pas avant.
 */
export function SupplierLocked({
  status,
  onOpenSetup,
}: {
  status: SupplierStatus;
  onOpenSetup: () => void;
}) {
  const colors = useColors();
  const pending = status === 'en_verification';

  return (
    <Screen testID="supplier-locked">
      <View className="flex-1 items-center justify-center gap-4 px-4">
        <View className="h-20 w-20 items-center justify-center rounded-pill border-2 border-brand-500">
          <Feather name={pending ? 'clock' : 'shield'} size={34} color={colors.brand500} />
        </View>
        <AppText variant="display" className="text-center text-2xl">
          {pending ? 'Dossier en cours de contrôle' : 'Compte à valider'}
        </AppText>
        <AppText variant="caption" className="text-center">
          {pending
            ? 'TK LINK vérifie votre entreprise. Vous pourrez publier des offres pro dès la validation.'
            : 'Déposez vos informations pro pour que TK LINK vérifie votre entreprise : la publication d’offres s’ouvre ensuite.'}
        </AppText>
        <View className="w-full">
          <Button
            testID="supplier-locked-open"
            label={pending ? 'Voir l’avancement' : 'Finaliser mon dossier'}
            onPress={onOpenSetup}
          />
        </View>
      </View>
    </Screen>
  );
}
