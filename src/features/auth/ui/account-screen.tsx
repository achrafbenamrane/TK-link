import { Alert, View } from 'react-native';

import { AppText, Button, Screen } from '@/shared/ui';

import { useAuthStore } from '../model/store';

/**
 * Minimal account screen — sign out + the required in-app **account deletion**
 * path (Apple 5.1.1(v) / Google Play). Apps built on the skeleton must surface a
 * route to this screen from their settings/profile so deletion is easy to find.
 * Visual design lands in Phase 4; the compliance mechanism is what matters here.
 */
export function AccountScreen() {
  const signOut = useAuthStore((s) => s.signOut);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);

  const confirmDelete = () => {
    Alert.alert(
      'Supprimer le compte ?',
      'Votre compte, vos commandes et vos points seront définitivement effacés. Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            void deleteAccount();
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <View className="flex-1 justify-end gap-3 pb-6">
        <Button
          testID="account-sign-out"
          variant="secondary"
          label="Se déconnecter"
          onPress={() => void signOut()}
        />
        <Button
          testID="account-delete"
          variant="destructive"
          label="Supprimer mon compte"
          onPress={confirmDelete}
        />
        <AppText variant="caption" className="text-center">
          La suppression du compte efface définitivement toutes vos données.
        </AppText>
      </View>
    </Screen>
  );
}
