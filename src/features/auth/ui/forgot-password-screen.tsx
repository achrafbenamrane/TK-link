import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';

import { AppText, BrandBar, Button, Screen, ScreenIntro, TextField } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

import { friendlyAuthError } from '../model/auth-errors';
import { IDENTIFIER_MESSAGE, maskEmail, parseIdentifier } from '../model/identifier';
import { PasswordSchema } from '../model/schema';
import { selectDemoMode, useAuthStore } from '../model/store';
import { CodeStep } from './code-step';
import { DemoNotice } from './demo-notice';

type Step =
  { name: 'request' } | { name: 'code'; email: string } | { name: 'password' } | { name: 'done' };

type Props = {
  /** Mot de passe changé : la personne est connectée, la route l'emmène dans l'app. */
  onDone?: () => void;
  /** Retour à l'écran de connexion. */
  onBack?: () => void;
};

/**
 * MOT DE PASSE OUBLIÉ — trois étapes, toutes par code, sans lien à ouvrir :
 *
 * 1. **L'adresse e-mail** → un code est envoyé (par Resend). Par SMS, pas encore : il n'y a pas de
 *    vérification de numéro avant Prelude. Un numéro saisi ici reçoit donc un message qui le dit.
 * 2. **Le code** à six chiffres → il ouvre une session (c'est elle qui autorise le changement).
 * 3. **Le nouveau mot de passe** → la personne est connectée.
 *
 * Pourquoi un code et pas un lien : un lien de récupération doit rouvrir l'app par un lien vérifié
 * (SEC-AUTH-002) et se casse dès que le client de messagerie le précharge. Un code se recopie, ne
 * dépend d'aucun domaine, et marche de la même façon pour un e-mail et pour un SMS.
 *
 * ANTI-ÉNUMÉRATION : on passe à l'étape du code que l'identifiant ait un compte ou non, avec une
 * phrase qui n'affirme rien (« Si un compte existe… »). Répondre « aucun compte pour cette adresse »
 * permettrait de sonder une liste d'adresses.
 */
export function ForgotPasswordScreen({ onDone, onBack }: Props) {
  const colors = useColors();
  const demo = useAuthStore(selectDemoMode);
  const requestPasswordReset = useAuthStore((s) => s.requestPasswordReset);
  const verifyResetCode = useAuthStore((s) => s.verifyResetCode);
  const setNewPassword = useAuthStore((s) => s.setNewPassword);

  const [step, setStep] = useState<Step>({ name: 'request' });
  const [raw, setRaw] = useState('');
  const [identifierError, setIdentifierError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const request = async () => {
    const id = parseIdentifier(raw);
    if (!id.ok) {
      // Écran « e-mail seulement » : ni le champ vide ni un numéro mal formé ne parlent de téléphone.
      setIdentifierError(
        id.hint === 'empty' ? 'Entrez votre adresse e-mail.' : IDENTIFIER_MESSAGE.email,
      );
      return;
    }
    if (id.identifier.kind === 'phone') {
      setIdentifierError(
        'La récupération par SMS arrive bientôt. Entrez l’adresse e-mail de votre compte.',
      );
      return;
    }
    setIdentifierError(null);
    setServerError(null);
    setSending(true);
    const result = await requestPasswordReset(id.identifier.value);
    setSending(false);
    if (result.ok) setStep({ name: 'code', email: result.email });
    else setServerError(friendlyAuthError(result.error));
  };

  const savePassword = async () => {
    const parsed = PasswordSchema.safeParse(password);
    if (!parsed.success) {
      setPasswordError(parsed.error.issues[0]?.message ?? 'Mot de passe invalide.');
      return;
    }
    if (password !== confirm) {
      setPasswordError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setPasswordError(null);
    setSaving(true);
    const result = await setNewPassword(password);
    setSaving(false);
    if (result.ok) setStep({ name: 'done' });
    else setPasswordError(friendlyAuthError(result.error));
  };

  return (
    <Screen testID="forgot-password-screen">
      <BrandBar
        {...(onBack && step.name !== 'done' ? { onBack } : {})}
        backTestID="forgot-back"
        backLabel="Retour à la connexion"
      />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerClassName="flex-grow pb-8 pt-6"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <DemoNotice />

          {step.name === 'request' ? (
            <View testID="forgot-request" className="gap-4">
              <ScreenIntro
                className="mb-4"
                title="Mot de passe oublié"
                subtitle="Entrez l’adresse e-mail de votre compte : nous vous envoyons un code pour choisir un nouveau mot de passe."
              />

              <View className="gap-1.5">
                <View className="flex-row">
                  <TextField
                    testID="forgot-identifier"
                    icon="mail"
                    value={raw}
                    onChangeText={(v) => {
                      setRaw(v);
                      setIdentifierError(null);
                    }}
                    placeholder="vous@exemple.fr"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    accessibilityLabel="Adresse e-mail"
                    invalid={!!identifierError}
                  />
                </View>
                {identifierError ? (
                  <AppText
                    testID="forgot-identifier-error"
                    variant="caption"
                    className="text-brand-600"
                  >
                    {identifierError}
                  </AppText>
                ) : null}
              </View>

              {serverError ? (
                <View className="flex-row items-start gap-2 rounded-control border border-brand-200 bg-brand-50 p-3">
                  <Feather name="alert-circle" size={15} color={colors.brand600} />
                  <AppText
                    testID="forgot-error"
                    variant="caption"
                    className="flex-1 text-brand-600"
                  >
                    {serverError}
                  </AppText>
                </View>
              ) : null}

              <Button
                testID="forgot-submit"
                label="Recevoir un code"
                loading={sending}
                onPress={() => void request()}
              />
            </View>
          ) : null}

          {step.name === 'code' ? (
            <CodeStep
              testIDPrefix="forgot-code"
              title="Entrez le code"
              sentTo={maskEmail(step.email)}
              description={`Si un compte existe pour ${maskEmail(step.email)}, un code à 6 chiffres vient d’être envoyé.`}
              demo={demo}
              onSubmit={async (code) => {
                const result = await verifyResetCode(step.email, code);
                if (result.ok) setStep({ name: 'password' });
                return result;
              }}
              onResend={() => requestPasswordReset(step.email)}
              onBack={() => setStep({ name: 'request' })}
              backLabel="Changer d’adresse e-mail"
            />
          ) : null}

          {step.name === 'password' ? (
            <View testID="forgot-password-step" className="gap-4">
              <ScreenIntro
                className="mb-4"
                title="Nouveau mot de passe"
                subtitle="Code vérifié. Choisissez un mot de passe d’au moins 8 caractères."
              />

              <View className="gap-2">
                <View className="flex-row">
                  <TextField
                    testID="forgot-password"
                    icon="lock"
                    value={password}
                    onChangeText={(v) => {
                      setPassword(v);
                      setPasswordError(null);
                    }}
                    placeholder="Nouveau mot de passe"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoComplete="new-password"
                    textContentType="newPassword"
                    accessibilityLabel="Nouveau mot de passe"
                    invalid={!!passwordError}
                    accessory={
                      <Pressable
                        testID="forgot-eye"
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
                <View className="flex-row">
                  <TextField
                    testID="forgot-confirm"
                    icon="lock"
                    value={confirm}
                    onChangeText={(v) => {
                      setConfirm(v);
                      setPasswordError(null);
                    }}
                    placeholder="Confirmer le mot de passe"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoComplete="new-password"
                    textContentType="newPassword"
                    accessibilityLabel="Confirmation du mot de passe"
                    invalid={!!passwordError}
                  />
                </View>
                {passwordError ? (
                  <AppText
                    testID="forgot-password-error"
                    variant="caption"
                    className="text-brand-600"
                  >
                    {passwordError}
                  </AppText>
                ) : null}
              </View>

              <Button
                testID="forgot-save"
                label="Changer le mot de passe"
                loading={saving}
                onPress={() => void savePassword()}
              />
            </View>
          ) : null}

          {step.name === 'done' ? (
            <View testID="forgot-done" className="items-center gap-4">
              <View className="h-16 w-16 items-center justify-center rounded-pill bg-success/15">
                <Feather name="check" size={30} color={colors.success} />
              </View>
              <AppText variant="title" className="text-center">
                Mot de passe modifié
              </AppText>
              <AppText variant="caption" className="text-center text-ink-muted">
                Vous êtes connecté avec votre nouveau mot de passe.
              </AppText>
              <Button
                testID="forgot-continue"
                label="Continuer"
                className="self-stretch"
                onPress={() => onDone?.()}
              />
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
