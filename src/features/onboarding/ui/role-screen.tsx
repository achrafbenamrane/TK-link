import { Feather } from '@expo/vector-icons';
import { Pressable, ScrollView, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { ROLE_ICON, ROLE_LABEL, ROLES, type Role } from '@/shared/lib/roles';
import { AppText, Screen, ThemeToggle, Wordmark } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

type Props = {
  /** Le profil choisi — la route le range et ouvre l'inscription. */
  onPick: (role: Role) => void;
  /** « J'ai déjà un compte » : la connexion se fait en connaissant déjà son rôle. */
  onSignIn: () => void;
};

const TITLE: Record<Role, string> = {
  consommateur: 'Client',
  commercant: 'Commerçant',
  grossiste: 'Grossiste',
  livreur: 'Livreur',
};

const HINT: Record<Role, string> = {
  consommateur: 'Je cherche les ventes flash près de chez moi',
  commercant: 'Je publie mes invendus en vente flash',
  grossiste: 'Je propose mes lots aux commerçants',
  livreur: 'Je livre les commandes de mon quartier',
};

/**
 * « QUI ÊTES-VOUS ? » — le premier choix du parcours, avant l'inscription et la
 * connexion.
 *
 * TK LINK a quatre profils qui ne voient pas la même application : le client
 * (ventes flash), le commerçant (commandes, Flash), le grossiste (lots) et le
 * livreur (missions). Le demander d'abord évite d'inscrire quelqu'un dans le
 * mauvais espace, puis de le lui faire changer. Le choix peut se refaire plus
 * tard depuis le compte.
 */
export function RoleScreen({ onPick, onSignIn }: Props) {
  const colors = useColors();

  return (
    <Screen testID="role-screen">
      <ScrollView contentContainerClassName="gap-4 pb-8 pt-3" showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center justify-between">
          <Wordmark size={24} />
          <ThemeToggle />
        </View>

        <View className="gap-1.5 pt-2">
          <AppText variant="display" style={{ fontSize: 28 }}>
            Qui êtes-vous ?
          </AppText>
          <AppText variant="caption">
            Choisissez votre profil : votre espace s’adapte. Vous pourrez en changer plus tard.
          </AppText>
        </View>

        <View className="gap-3">
          {ROLES.map((role) => (
            <Pressable
              key={role}
              testID={`role-${role}`}
              accessibilityRole="button"
              accessibilityLabel={`${ROLE_LABEL[role]} — ${HINT[role]}`}
              onPress={() => onPick(role)}
              className={cn(
                'flex-row items-center gap-4 rounded-card border border-line bg-surface-muted p-4',
                'active:border-brand-500 active:bg-brand-50',
              )}
            >
              <View className="h-14 w-14 items-center justify-center rounded-pill bg-brand-50">
                <Feather name={ROLE_ICON[role] as 'user'} size={24} color={colors.brand500} />
              </View>
              <View className="flex-1 gap-0.5">
                <AppText className="font-sans-bold text-ink" style={{ fontSize: 17 }}>
                  {TITLE[role]}
                </AppText>
                <AppText variant="caption" className="text-ink-faint">
                  {HINT[role]}
                </AppText>
              </View>
              <Feather name="chevron-right" size={20} color={colors.inkFaint} />
            </Pressable>
          ))}
        </View>

        <Pressable
          testID="role-signin"
          accessibilityRole="button"
          onPress={onSignIn}
          className="items-center py-3"
        >
          <AppText className="text-ink-muted" style={{ fontSize: 14 }}>
            J’ai déjà un compte ·{' '}
            <AppText className="font-sans-bold text-brand-600">Me connecter</AppText>
          </AppText>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
