import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText, Button, Screen, TextField } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { friendlyAuthError } from '../model/auth-errors';
import { CredentialsSchema } from '../model/schema';
import { useAuthStore } from '../model/store';

type Mode = 'sign-in' | 'sign-up';
type FieldErrors = { email?: string; password?: string };

const ARGUMENTS = [
  'Les ventes flash de votre quartier',
  'Livraison offerte, sans frais cachés',
  'Vos points de fidélité, partageables',
];

/**
 * Première impression de l'app : elle doit parler la même langue que le reste
 * (français) et ressembler à Freedoo, pas à un formulaire générique.
 *
 * Les erreurs sont affichées SOUS LE CHAMP concerné plutôt qu'en une ligne
 * commune : avec deux champs, un message global oblige à deviner lequel corriger.
 */
export function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<Mode>('sign-in');
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState(false);

  const storeError = useAuthStore((s) => s.error);
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);

  // L'erreur du serveur ne s'affiche qu'après une tentative : sinon une erreur
  // d'une session précédente accueille l'utilisateur à l'ouverture.
  const serverError = useMemo(
    () => (touched ? friendlyAuthError(storeError) : null),
    [touched, storeError],
  );

  const submit = async () => {
    // Validation locale d'abord : inutile d'aller au réseau pour apprendre
    // qu'il manque un « @ ».
    const parsed = CredentialsSchema.safeParse({ email: email.trim(), password });
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors | undefined;
        if (key && !next[key]) next[key] = issue.message;
      }
      setFieldErrors(next);
      setTouched(true);
      return;
    }

    setFieldErrors({});
    setTouched(true);
    setSubmitting(true);
    await (mode === 'sign-in'
      ? signIn(parsed.data.email, parsed.data.password)
      : signUp(parsed.data.email, parsed.data.password));
    setSubmitting(false);
  };

  const toggleMode = () => {
    setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
    setFieldErrors({});
    setTouched(false);
  };

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
            <AppText className="font-display text-ink" style={{ fontSize: 34, lineHeight: 44 }}>
              Freedoo<AppText className="text-brand-500">.</AppText>
            </AppText>
            <AppText variant="caption" className="mt-1">
              {mode === 'sign-in'
                ? 'Content de vous revoir.'
                : 'Créez votre compte, c’est gratuit.'}
            </AppText>
          </View>

          {mode === 'sign-up' ? (
            <View className="mb-6 gap-2.5 rounded-card bg-ink p-4">
              {ARGUMENTS.map((line) => (
                <View key={line} className="flex-row items-center gap-2.5">
                  <Feather name="check" size={14} color={colors.brand500} />
                  <AppText className="flex-1 text-sm text-ink-inverse">{line}</AppText>
                </View>
              ))}
            </View>
          ) : null}

          <View className="gap-3">
            <View className="gap-1.5">
              <AppText variant="caption" className="font-sans-semibold text-ink-muted">
                Adresse e-mail
              </AppText>
              <View className="flex-row">
                <TextField
                  testID="auth-email"
                  value={email}
                  onChangeText={(v) => {
                    setEmail(v);
                    setFieldErrors((e) => ({ ...e, email: undefined }));
                  }}
                  placeholder="vous@exemple.fr"
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  className={cn(fieldErrors.email && 'border-brand-500')}
                />
              </View>
              {fieldErrors.email ? (
                <AppText testID="auth-email-error" variant="caption" className="text-brand-600">
                  {fieldErrors.email}
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
                  secureTextEntry
                  textContentType={mode === 'sign-in' ? 'password' : 'newPassword'}
                  className={cn(fieldErrors.password && 'border-brand-500')}
                />
              </View>
              {fieldErrors.password ? (
                <AppText testID="auth-password-error" variant="caption" className="text-brand-600">
                  {fieldErrors.password}
                </AppText>
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
                label={mode === 'sign-in' ? 'Se connecter' : 'Créer mon compte'}
                loading={submitting}
                onPress={submit}
              />
            </View>

            <Pressable
              testID="auth-toggle"
              accessibilityRole="button"
              onPress={toggleMode}
              className="py-3"
            >
              <AppText variant="caption" className="text-center text-ink-muted">
                {mode === 'sign-in' ? 'Pas encore de compte ? ' : 'Vous avez déjà un compte ? '}
                <AppText className="font-sans-bold text-brand-600">
                  {mode === 'sign-in' ? 'Créer un compte' : 'Se connecter'}
                </AppText>
              </AppText>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
