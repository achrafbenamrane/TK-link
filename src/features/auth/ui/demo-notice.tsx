import { Feather } from '@expo/vector-icons';
import { View } from 'react-native';

import { AppText } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { useAuthStore, selectDemoMode } from '../model/store';

/**
 * Le bandeau qui dit la vérité : aucun serveur n'est branché.
 *
 * Sans lui, le mode démonstration serait un mensonge — on créerait un compte,
 * on verrait « bienvenue », et personne ne saurait que rien n'a été enregistré
 * ni vérifié. Un écran de connexion qui fait semblant est pire qu'un écran de
 * connexion en panne.
 *
 * Il disparaît de lui-même dès que `EXPO_PUBLIC_SUPABASE_URL` et la clé anon
 * sont renseignées : c'est le même drapeau qui pilote le comportement du store.
 */
export function DemoNotice() {
  const demoMode = useAuthStore(selectDemoMode);
  if (!demoMode) return null;

  return (
    <View
      testID="auth-demo-notice"
      accessibilityRole="alert"
      className="mb-4 flex-row items-start gap-2.5 rounded-card border border-line bg-surface-muted p-3.5"
    >
      <Feather name="info" size={16} color={colors.inkFaint} />
      <View className="flex-1">
        <AppText className="font-sans-semibold text-ink" style={{ fontSize: 12.5 }}>
          Mode démonstration
        </AppText>
        <AppText variant="caption" className="mt-0.5 text-ink-muted" style={{ fontSize: 12 }}>
          Aucun serveur n’est encore connecté : votre compte reste sur ce téléphone et n’est vérifié
          par personne.
        </AppText>
      </View>
    </View>
  );
}
