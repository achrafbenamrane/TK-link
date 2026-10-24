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
import { displayPhone, maskPhone } from '../model/identifier';
import { selectDemoMode, selectSession, useAuthStore } from '../model/store';
import { CodeStep } from './code-step';
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
 * MON COMPTE — l'identité de connexion, la vérification du numéro, la déconnexion, et le chemin
 * EXIGÉ par les stores pour supprimer son compte depuis l'app (Apple 5.1.1(v), Google Play). Il
 * doit être facile à trouver : on y accède depuis le profil, en première ligne.
 */
export function AccountScreen({ onSignOut, onAccountDeleted, onSignIn }: Props = {}) {
  const colors = useColors();
  const session = useAuthStore(selectSession);
  const demo = useAuthStore(selectDemoMode);
  const signOut = useAuthStore((s) => s.signOut);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);
  const startPhoneVerification = useAuthStore((s) => s.startPhoneVerification);
  const confirmPhone = useAuthStore((s) => s.confirmPhone);
  const resendPhoneCode = useAuthStore((s) => s.resendPhoneCode);

  const account = describeAccount(session);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [phoneStep, setPhoneStep] = useState<'idle' | 'sending' | 'code' | 'verified'>('idle');
  const [phoneError, setPhoneError] = useState<string | null>(null);

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

  const verifyPhone = async (phone: string) => {
    setPhoneStep('sending');
    setPhoneError(null);
    const result = await startPhoneVerification(phone);
    if (result.ok) setPhoneStep('code');
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

  if (phoneStep === 'code' && account.phone) {
    const phone = account.phone;
    return (
      <Screen testID="account-screen">
        <ScrollView
          contentContainerClassName="flex-grow justify-center py-8"
          keyboardShouldPersistTaps="handled"
        >
          <CodeStep
            testIDPrefix="account-phone"
            title="Vérifiez votre numéro"
            sentTo={maskPhone(phone)}
            demo={demo}
            onSubmit={async (code) => {
              const result = await confirmPhone(phone, code);
              if (result.ok) setPhoneStep('verified');
              return result;
            }}
            onResend={() => resendPhoneCode(phone)}
            onBack={() => setPhoneStep('idle')}
            backLabel="Annuler"
          />
        </ScrollView>
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
                    account.phoneVerified
                      ? 'rounded-pill bg-success/15 px-2.5 py-1'
                      : 'rounded-pill bg-surface-muted px-2.5 py-1'
                  }
                >
                  <AppText
                    className={
                      account.phoneVerified ? 'font-sans-semibold text-success' : 'text-ink-muted'
                    }
                    style={{ fontSize: 11.5 }}
                  >
                    {account.phoneVerified ? 'Vérifié' : 'Non vérifié'}
                  </AppText>
                </View>
              </View>
              {!account.phoneVerified ? (
                <AppText variant="caption" className="text-ink-faint">
                  Un numéro vérifié permet aussi de vous connecter avec lui.
                </AppText>
              ) : null}
              {!account.phoneVerified && isPhoneAuthEnabled ? (
                <Button
                  testID="account-verify-phone"
                  label="Vérifier mon numéro"
                  variant="secondary"
                  size="sm"
                  loading={phoneStep === 'sending'}
                  onPress={() => void verifyPhone(account.phone as string)}
                />
              ) : null}
              {phoneError ? (
                <AppText testID="account-phone-error" variant="caption" className="text-brand-600">
                  {phoneError}
                </AppText>
              ) : null}
              {phoneStep === 'verified' ? (
                <AppText testID="account-phone-verified" variant="caption" className="text-success">
                  Numéro vérifié : vous pouvez maintenant vous connecter avec lui.
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
