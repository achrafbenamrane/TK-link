import { Feather } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { AppText } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

import { PRO_COPY, type ProRole, type SupplierStatus } from '../lib/supplier';

/**
 * Le rappel, en haut du tableau de bord, d'un dossier professionnel pas encore validé
 * (étapes 3 à 6 des cartes « Process commerçant » et « Process grossiste »). Il disparaît dès
 * que TK LINK a validé le compte.
 */
export function ProStatusBanner({
  status,
  role,
  onPress,
}: {
  status: SupplierStatus;
  role: ProRole;
  onPress: () => void;
}) {
  const colors = useColors();
  if (status === 'valide') return null;

  return (
    <Pressable
      testID="pro-setup-banner"
      accessibilityRole="button"
      accessibilityLabel="Finaliser mon dossier professionnel"
      onPress={onPress}
      className="mb-4 flex-row items-center gap-3 rounded-card border border-warning bg-surface-muted p-3.5"
    >
      <Feather name="shield" size={20} color={colors.brand500} />
      <View className="flex-1">
        <AppText className="font-sans-bold text-ink" style={{ fontSize: 13.5 }}>
          {status === 'en_verification'
            ? 'Dossier en cours de contrôle'
            : `Finalisez votre dossier ${PRO_COPY[role].account}`}
        </AppText>
        <AppText variant="caption" style={{ fontSize: 11.5 }}>
          Votre accès à {PRO_COPY[role].publish} s’ouvre une fois votre dossier vérifié par TK LINK.
        </AppText>
      </View>
      <Feather name="chevron-right" size={18} color={colors.inkFaint} />
    </Pressable>
  );
}
