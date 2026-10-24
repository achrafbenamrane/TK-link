import { Feather } from '@expo/vector-icons';
import { useState, type ComponentProps } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { isPhoneAuthEnabled } from '@/shared/lib/env';
import { AppText, Button, Screen } from '@/shared/ui';
import { BackButton } from '@/shared/ui/back-button';
import { useColors } from '@/shared/theme/theme-provider';

import { describeAccount, type AccountProvider } from '../model/account';
import { friendlyAuthError } from '../model/auth-errors';
import { displayPhone } from '../model/identifier';
import { selectSession, useAuthStore } from '../model/store';
import { DemoNotice } from './demo-notice';

type Props = {
  /**
   * Se déconnecter. La route remet alors l'app à zéro et rouvre l'accueil, comme depuis le profil.
   * Absent : on ferme seulement la session.
   */
  onSignOut?: () => void;
  /** Le compte vient d'être supprimé : la route efface aussi les données locales. */
  onAccountDeleted?: () => void;
  /** Aucune session : mène à la connexion. */
  onSignIn?: () => void;
};

const PROVIDER_LABEL: Record<AccountProvider, string> = {
  email: 'E-mail et mot de passe',
  phone: 'Téléphone et mot de passe',
  google: 'Google',
  apple: 'Apple',
  demo: 'Compte de démonstration',
};

/**
 * MON COMPTE — l'identité de connexion, le numéro associé, la déconnexion, et le chemin
 * EXIGÉ par les stores pour supprimer son compte depuis l'app (Apple 5.1.1(v), Google Play). Il
 * doit être facile à trouver : on y accède depuis le profil, en première ligne.
 */
export function AccountScreen({ onSignOut, onAccountDeleted, onSignIn }: Props = {}) {
  const colors = useColors();
  const session = useAuthStore(selectSession);
  const signOut = useAuthStore((s) => s.signOut);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);
  const linkPhone = useAuthStore((s) => s.linkPhone);

  const account = describeAccount(session);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [phoneStep, setPhoneStep] = useState<'idle' | 'linking' | 'linked'>('idle');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  // Associé à l'instant : la réponse du serveur fait foi, même si la session n'a pas pu être
  // rafraîchie tout de suite (elle le sera au prochain renouvellement du jeton).
  const phoneLinked = Boolean(account?.phoneLinked) || phoneStep === 'linked';

  const leave = () => {
    if (onSignOut) onSignOut();
    else void signOut();
  };

  const remove = async () => {
    setDeleting(true);
    setError(null);
    const result = await deleteAccount();
    setDeleting(false);
    if (result.ok) onAccountDeleted?.();
    else setError(friendlyAuthError(result.error));
  };

  const confirmDelete = () => {
    Alert.alert(
      'Supprimer le compte ?',
      'Votre compte, vos commandes et vos points seront définitivement effacés. Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => void remove() },
      ],
    );
  };

  /** Associe le numéro saisi à l'inscription — sans code pour l'instant (voir `linkPhone`). */
  const associate = async (phone: string) => {
    setPhoneStep('linking');
    setPhoneError(null);
    const result = await linkPhone(phone);
    if (result.ok) setPhoneStep('linked');
    else {
      setPhoneStep('idle');
      setPhoneError(friendlyAuthError(result.error));
    }
  };

  if (!account) {
    return (
      <Screen testID="account-screen">
        <BackButton fallbackHref="/profil" />
        <View className="flex-1 justify-center gap-4">
          <AppText variant="title">Mon compte</AppText>
          <AppText variant="caption" className="text-ink-muted">
            Vous n’êtes pas connecté. Connectez-vous pour retrouver vos commandes et vos points sur
            tous vos appareils.
          </AppText>
          {onSignIn ? (
            <Button testID="account-sign-in" label="Se connecter" onPress={onSignIn} />
          ) : null}
        </View>
      </Screen>
    );
  }

  return (
    <Screen testID="account-screen">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-4 pb-8">
        <BackButton fallbackHref="/profil" />
        <AppText variant="display" className="text-2xl">
          Mon compte
        </AppText>

        <DemoNotice />

        <View className="rounded-card border border-line bg-surface px-4">
          <Row
            first
            testID="account-provider"
            icon="key"
            label="Connexion"
            value={PROVIDER_LABEL[account.provider]}
          />
          {account.email ? (
            <Row testID="account-email" icon="mail" label="E-mail" value={account.email} />
          ) : null}
          {account.phone ? (
            <View className="gap-2 border-t border-line py-3.5">
              <View className="flex-row items-center gap-3">
                <Feather name="smartphone" size={17} color={colors.inkMuted} />
                <View className="flex-1">
                  <AppText variant="caption" className="text-ink-muted">
                    Téléphone
                  </AppText>
                  <AppText testID="account-phone" className="text-ink" style={{ fontSize: 14.5 }}>
                    {displayPhone(account.phone)}
                  </AppText>
                </View>
                <View
                  testID="account-phone-status"
                  className={
                    phoneLinked
                      ? 'rounded-pill bg-success/15 px-2.5 py-1'
                      : 'rounded-pill bg-surface-muted px-2.5 py-1'
                  }
                >
                  <AppText
                    className={phoneLinked ? 'font-sans-semibold text-success' : 'text-ink-muted'}
                    style={{ fontSize: 11.5 }}
                  >
                    {phoneLinked ? 'Associé' : 'Non associé'}
                  </AppText>
                </View>
              </View>
              {phoneStep === 'linked' ? (
                <AppText testID="account-phone-linked" variant="caption" className="text-success">
                  Numéro associé : vous pouvez maintenant vous connecter avec lui.
                </AppText>
              ) : phoneLinked ? (
                <AppText variant="caption" className="text-ink-faint">
                  Vous pouvez vous connecter avec ce numéro et votre mot de passe.
                </AppText>
              ) : isPhoneAuthEnabled ? (
                <>
                  <AppText variant="caption" className="text-ink-faint">
                    Associez-le pour pouvoir aussi vous connecter avec lui.
                  </AppText>
                  <Button
                    testID="account-link-phone"
                    label="Associer ce numéro"
                    variant="secondary"
                    size="sm"
                    loading={phoneStep === 'linking'}
                    onPress={() => void associate(account.phone as string)}
                  />
                </>
              ) : null}
              {phoneError ? (
                <AppText testID="account-phone-error" variant="caption" className="text-brand-600">
                  {phoneError}
                </AppText>
              ) : null}
            </View>
          ) : null}
        </View>

        {error ? (
          <View className="flex-row items-start gap-2 rounded-control border border-brand-200 bg-brand-50 p-3">
            <Feather name="alert-circle" size={15} color={colors.brand600} />
            <AppText testID="account-error" variant="caption" className="flex-1 text-brand-600">
              {error}
            </AppText>
          </View>
        ) : null}

        <View className="gap-3 pt-2">
          <Button
            testID="account-sign-out"
            variant="secondary"
            label="Se déconnecter"
            onPress={leave}
          />
          <Button
            testID="account-delete"
            variant="destructive"
            label="Supprimer mon compte"
            loading={deleting}
            onPress={confirmDelete}
          />
          <AppText variant="caption" className="text-center">
            La suppression du compte efface définitivement toutes vos données.
          </AppText>
        </View>
      </ScrollView>
    </Screen>
  );
}

function Row({
  first = false,
  testID,
  icon,
  label,
  value,
}: {
  /** La première ligne n'a pas de filet au-dessus. */
  first?: boolean;
  testID: string;
  icon: ComponentProps<typeof Feather>['name'];
  label: string;
  value: string;
}) {
  const colors = useColors();
  return (
    <View
      testID={testID}
      className={cn('flex-row items-center gap-3 py-3.5', !first && 'border-t border-line')}
    >
      <Feather name={icon} size={17} color={colors.inkMuted} />
      <View className="flex-1">
        <AppText variant="caption" className="text-ink-muted">
          {label}
        </AppText>
        <AppText className="text-ink" style={{ fontSize: 14.5 }} numberOfLines={1}>
          {value}
        </AppText>
      </View>
    </View>
  );
}
