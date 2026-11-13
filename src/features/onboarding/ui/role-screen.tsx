import { Feather } from '@expo/vector-icons';
import { Pressable, ScrollView, View } from 'react-native';

import { ROLE_ICON, ROLE_LABEL, ROLES, type Role } from '@/shared/lib/roles';
import { AppText, BrandBar, Screen, ScreenIntro } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

type Props = {
  /** Le profil choisi — la route le range et ouvre l'inscription. */
  onPick: (role: Role) => void;
  /** « J'ai déjà un compte » : la connexion se fait en connaissant déjà son rôle. */
  onSignIn: () => void;
  /**
   * Ouvre l'app de ce profil déjà remplie d'exemples (commandes, images, textes) — pour
   * montrer au client ce que chacun voit. Absent : pas de bouton « Démo ».
   */
  onDemo?: (role: Role) => void;
};

const TITLE: Record<Role, string> = {
  consommateur: 'Client',
  commercant: 'Commerçant',
  grossiste: 'Grossiste',
};

const HINT: Record<Role, string> = {
  consommateur: 'Je cherche les ventes flash près de chez moi',
  commercant: 'Je publie mes invendus en vente flash',
  grossiste: 'Je propose mes lots aux commerçants',
};

/**
 * « QUI ÊTES-VOUS ? » — le premier choix du parcours, avant l'inscription et la
 * connexion.
 *
 * TK LINK a trois profils qui ne voient pas la même application : le client
 * (ventes flash), le commerçant (commandes, Flash) et le grossiste (lots). Le
 * livreur n'en fait plus partie depuis le 13/11/2026 : les livraisons sont
 * confiées à Uber Direct. Le demander d'abord évite d'inscrire quelqu'un dans le
 * mauvais espace, puis de le lui faire changer. Le choix peut se refaire plus
 * tard depuis le compte.
 */
export function RoleScreen({ onPick, onSignIn, onDemo }: Props) {
  const colors = useColors();

  return (
    <Screen testID="role-screen">
      <BrandBar />
      <ScrollView
        contentContainerClassName="flex-grow pb-8 pt-6"
        showsVerticalScrollIndicator={false}
      >
        <ScreenIntro
          title="Qui êtes-vous ?"
          subtitle="Choisissez votre profil : votre espace s’adapte. Vous pourrez en changer plus tard."
        />

        <View className="gap-3">
          {ROLES.map((role) => (
            <View
              key={role}
              className="flex-row items-center rounded-card border border-line bg-surface-muted"
            >
              <Pressable
                testID={`role-${role}`}
                accessibilityRole="button"
                accessibilityLabel={`${ROLE_LABEL[role]} — ${HINT[role]}`}
                onPress={() => onPick(role)}
                className="flex-1 flex-row items-center gap-4 p-4 active:opacity-70"
              >
                <View className="h-14 w-14 items-center justify-center rounded-pill bg-brand-50">
                  <Feather name={ROLE_ICON[role] as 'user'} size={24} color={colors.brand500} />
                </View>
                <View className="flex-1 gap-0.5">
                  <AppText className="font-sans-bold text-lg text-ink">{TITLE[role]}</AppText>
                  <AppText variant="caption" className="text-ink-faint">
                    {HINT[role]}
                  </AppText>
                </View>
              </Pressable>
              {onDemo ? (
                <Pressable
                  testID={`role-demo-${role}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Voir la démo ${ROLE_LABEL[role]}`}
                  onPress={() => onDemo(role)}
                  className="mr-3 rounded-pill border border-brand-500 bg-brand-50 px-3 py-1.5 active:opacity-70"
                >
                  <AppText className="font-sans-bold text-brand-600" style={{ fontSize: 12 }}>
                    Démo
                  </AppText>
                </Pressable>
              ) : (
                <View className="pr-4">
                  <Feather name="chevron-right" size={20} color={colors.inkFaint} />
                </View>
              )}
            </View>
          ))}
        </View>

        <Pressable
          testID="role-signin"
          accessibilityRole="button"
          onPress={onSignIn}
          className="mt-6 items-center py-3"
        >
          <AppText variant="caption" className="text-ink-muted">
            J’ai déjà un compte ·{' '}
            <AppText className="font-sans-bold text-sm text-brand-600">Me connecter</AppText>
          </AppText>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
