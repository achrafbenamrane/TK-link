import { Feather } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';

import { isPhoneAuthEnabled } from '@/shared/lib/env';
import { AppText, Button, Screen, TextField, Wordmark } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

import { friendlyAuthError } from '../model/auth-errors';
import { IDENTIFIER_MESSAGE, parseIdentifier } from '../model/identifier';
import { PasswordSchema } from '../model/schema';
import type { SocialProvider } from '../model/social/types';
import { useAuthStore } from '../model/store';
import { DemoNotice } from './demo-notice';
import { SocialSection } from './social-buttons';

type FieldErrors = { identifier?: string; password?: string };

/**
 * CONNEXION — e-mail OU numéro de téléphone + mot de passe, ou Google / Apple. L'empreinte digitale
 * vit dans l'écran dédié une fois le compte ouvert.
 *
 * L'INSCRIPTION a son propre écran depuis le CDC §5 : elle réclame sept champs
 * et un SIRET conditionnel, ce qui n'entre plus dans un simple basculement de
 * mode sur cet écran.
 *
 * Un SEUL champ pour l'identifiant : on devine s'il s'agit d'un e-mail ou d'un numéro (voir
 * `parseIdentifier`) plutôt que de faire choisir entre deux onglets avant d'avoir tapé.
 *
 * Les erreurs sont affichées SOUS LE CHAMP concerné plutôt qu'en une ligne
 * commune : avec deux champs, un message global oblige à deviner lequel corriger.
 */
type Props = {
  onCreateAccount?: () => void;
  /**
   * Connexion réussie : la route relit le profil du serveur, puis entre dans l'app. L'écran garde
   * son indicateur de chargement jusqu'à la fin de cette promesse — sans quoi le bouton se
   * réactiverait le temps du trajet, et l'utilisateur croirait que rien ne s'est passé.
   */
  onSignedIn?: () => void | Promise<void>;
  /**
   * Inscrire une BOUTIQUE, pas un compte de consommateur.
   *
   * Le formulaire existait déjà, mais on n'y accédait que depuis le profil —
   * donc après s'être créé un compte de particulier. Un commerçant qui ouvre
   * l'app pour référencer son commerce ne trouvait aucune porte là où il la
   * cherche : l'écran de connexion.
   */
  onMerchantSignUp?: () => void;
  /** « Mot de passe oublié ? » — la navigation reste à la route. Absent : pas de lien. */
  onForgotPassword?: () => void;
  /**
   * Google ou Apple ont ouvert la session : le prénom (quand le fournisseur le donne), que la route
   * range dans le profil local. L'écran ne connaît pas les autres tranches de l'app.
   */
  onProfile?: (profile: { firstName: string; lastName: string }) => void;
  /**
   * L'écran est au premier plan. Sous « Mot de passe oublié », il reste monté : la session que le
   * code de récupération ouvre ne doit PAS le faire entrer dans l'app avant le nouveau mot de passe.
   */
  active?: boolean;
};

export function SignInScreen({
  onCreateAccount,
  onSignedIn,
  onMerchantSignUp,
  onForgotPassword,
  onProfile,
  active = true,
}: Props = {}) {
  const colors = useColors();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [busy, setBusy] = useState<SocialProvider | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState(false);

  const storeError = useAuthStore((s) => s.error);
  const signIn = useAuthStore((s) => s.signIn);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const signInWithApple = useAuthStore((s) => s.signInWithApple);
  const status = useAuthStore((s) => s.status);
  // Une seule connexion à la fois, et une seule entrée dans l'app : deux appuis dans la même image
  // (Google puis « Se connecter ») lanceraient deux connexions.
  const entering = useRef(false);

  // Une session qui s'ouvre SANS appui sur cet écran — lancé hors ligne avec un jeton expiré, puis
  // renouvelé au retour du réseau — fait entrer dans l'app : on ne reste pas bloqué sur la connexion.
  useEffect(() => {
    if (!active || status !== 'authenticated' || entering.current || !onSignedIn) return;
    entering.current = true;
    void Promise.resolve(onSignedIn()).finally(() => {
      entering.current = false;
    });
  }, [active, status, onSignedIn]);

  // L'erreur du serveur ne s'affiche qu'après une tentative : sinon une erreur
  // d'une session précédente accueille l'utilisateur à l'ouverture.
  const serverError = useMemo(
    () => (touched ? friendlyAuthError(storeError) : null),
    [touched, storeError],
  );

  const submit = async () => {
    if (entering.current) return;
    // Validation locale d'abord : inutile d'aller au réseau pour apprendre
    // qu'il manque un « @ ».
    const id = parseIdentifier(identifier, { allowPhone: isPhoneAuthEnabled });
    const pw = PasswordSchema.safeParse(password);
    if (!id.ok || !pw.success) {
      const next: FieldErrors = {};
      if (!id.ok) next.identifier = IDENTIFIER_MESSAGE[id.hint];
      if (!pw.success) next.password = pw.error.issues[0]?.message ?? 'Mot de passe invalide.';
      setFieldErrors(next);
      setTouched(true);
      return;
    }

    setFieldErrors({});
    setTouched(true);
    entering.current = true;
    setSubmitting(true);
    try {
      const result = await signIn(id.identifier.value, password);
      if (result.ok) await onSignedIn?.();
    } finally {
      entering.current = false;
      setSubmitting(false);
    }
  };

  const social = async (provider: SocialProvider) => {
    if (entering.current) return;
    entering.current = true;
    setTouched(true);
    setBusy(provider);
    try {
      const result = provider === 'google' ? await signInWithGoogle() : await signInWithApple();
      if (result.ok) {
        if (result.firstName || result.lastName) {
          onProfile?.({ firstName: result.firstName, lastName: result.lastName });
        }
        await onSignedIn?.();
      }
    } finally {
      entering.current = false;
      setBusy(null);
    }
  };

  const working = submitting || busy !== null;

  return (
    <Screen testID="sign-in-screen">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center py-8"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-8">
            <Wordmark size={34} />
            <AppText variant="caption" className="mt-1">
              Content de vous revoir.
            </AppText>
          </View>

          <DemoNotice />

          <View className="gap-3">
            <View className="gap-1.5">
              <AppText variant="caption" className="font-sans-semibold text-ink-muted">
                {isPhoneAuthEnabled ? 'E-mail ou téléphone' : 'Adresse e-mail'}
              </AppText>
              <View className="flex-row">
                <TextField
                  testID="auth-identifier"
                  value={identifier}
                  onChangeText={(v) => {
                    setIdentifier(v);
                    setFieldErrors((e) => ({ ...e, identifier: undefined }));
                  }}
                  placeholder={
                    isPhoneAuthEnabled ? 'vous@exemple.fr ou 06 12 34 56 78' : 'vous@exemple.fr'
                  }
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="username"
                  textContentType="username"
                  accessibilityLabel={
                    isPhoneAuthEnabled ? 'E-mail ou numéro de téléphone' : 'Adresse e-mail'
                  }
                  icon="user"
                  invalid={!!fieldErrors.identifier}
                />
              </View>
              {fieldErrors.identifier ? (
                <AppText
                  testID="auth-identifier-error"
                  variant="caption"
                  className="text-brand-600"
                >
                  {fieldErrors.identifier}
                </AppText>
              ) : null}
            </View>

            <View className="gap-1.5">
              <AppText variant="caption" className="font-sans-semibold text-ink-muted">
                Mot de passe
              </AppText>
              <View className="flex-row">
                <TextField
                  testID="auth-password"
                  value={password}
                  onChangeText={(v) => {
                    setPassword(v);
                    setFieldErrors((e) => ({ ...e, password: undefined }));
                  }}
                  placeholder="8 caractères minimum"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="current-password"
                  textContentType="password"
                  accessibilityLabel="Mot de passe"
                  icon="lock"
                  invalid={!!fieldErrors.password}
                  accessory={
                    <Pressable
                      testID="auth-eye"
                      accessibilityRole="button"
                      accessibilityLabel={
                        showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'
                      }
                      hitSlop={10}
                      onPress={() => setShowPassword((v) => !v)}
                    >
                      <Feather
                        name={showPassword ? 'eye-off' : 'eye'}
                        size={17}
                        color={colors.inkFaint}
                      />
                    </Pressable>
                  }
                />
              </View>
              {fieldErrors.password ? (
                <AppText testID="auth-password-error" variant="caption" className="text-brand-600">
                  {fieldErrors.password}
                </AppText>
              ) : null}
              {onForgotPassword ? (
                <Pressable
                  testID="auth-forgot"
                  accessibilityRole="button"
                  accessibilityLabel="Mot de passe oublié"
                  hitSlop={8}
                  onPress={onForgotPassword}
                  className="self-end"
                >
                  <AppText variant="caption" className="font-sans-semibold text-brand-600">
                    Mot de passe oublié ?
                  </AppText>
                </Pressable>
              ) : null}
            </View>

            {serverError ? (
              <View className="flex-row items-start gap-2 rounded-control border border-brand-200 bg-brand-50 p-3">
                <Feather name="alert-circle" size={15} color={colors.brand600} />
                <AppText testID="auth-error" variant="caption" className="flex-1 text-brand-600">
                  {serverError}
                </AppText>
              </View>
            ) : null}

            <View className="mt-1">
              <Button
                testID="auth-submit"
                label="Se connecter"
                loading={submitting}
                disabled={busy !== null}
                onPress={submit}
              />
            </View>

            <SocialSection
              verb="Continuer avec"
              busy={busy}
              disabled={submitting}
              legal
              onSelect={(p) => !working && void social(p)}
            />

            {onCreateAccount ? (
              <Pressable
                testID="auth-toggle"
                accessibilityRole="button"
                accessibilityLabel="Créer un compte"
                onPress={onCreateAccount}
                className="py-3"
              >
                <AppText variant="caption" className="text-center text-ink-muted">
                  Pas encore de compte ?{' '}
                  <AppText className="font-sans-bold text-brand-600">Créer un compte</AppText>
                </AppText>
              </Pressable>
            ) : null}

            {/* L'entrée des COMMERÇANTS. La navigation reste à la route, comme
                pour « Créer un compte » : l'écran ne connaît pas les URL. */}
            {onMerchantSignUp ? (
              <View className="mt-1 border-t border-line pt-4">
                <Pressable
                  testID="auth-merchant"
                  accessibilityRole="link"
                  accessibilityLabel="Inscrire ma boutique sur TK LINK"
                  onPress={onMerchantSignUp}
                  className="py-2"
                >
                  <AppText variant="caption" className="text-center text-ink-muted">
                    Vous êtes commerçant ?{' '}
                    <AppText className="font-sans-bold text-brand-600">
                      Inscrire ma boutique
                    </AppText>
                  </AppText>
                </Pressable>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
