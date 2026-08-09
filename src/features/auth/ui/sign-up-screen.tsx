import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { formatSiret, ROLE_LABEL, type Role } from '@/shared/lib/roles';
import { AppText, Button, Screen, TextField } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { friendlyAuthError } from '../model/auth-errors';
import {
  EMPTY_REGISTRATION,
  needsSiret,
  toProfile,
  validateRegistration,
  type RegistrationDraft,
} from '../model/registration';
import { useAuthStore } from '../model/store';

type Props = {
  /** Rôle choisi à l'onboarding — passé par la route (pas d'import inter-feature). */
  role: Role;
  /** Le SIRET saisi, à ranger avec le rôle. Appelé avant la création du compte. */
  onSiretChange?: (siret: string) => void;
  onSignedUp?: () => void;
};

/**
 * INSCRIPTION — le formulaire du CDC §5, au complet.
 *
 * Prénom, nom, e-mail, téléphone, mot de passe + confirmation, localisation ;
 * SIRET en plus pour un professionnel. Le SIRET reste FACULTATIF ici : le CDC
 * ne l'exige que pour commander chez un grossiste, et bloquer l'inscription
 * dessus ferait fuir des comptes qu'on veut justement recruter.
 *
 * Chaque erreur s'affiche sous son champ. Un bandeau d'erreurs global oblige à
 * chercher lequel des huit champs corriger — c'est précisément ce qu'il ne faut
 * pas faire sur un formulaire long.
 */
export function SignUpScreen({ role, onSiretChange, onSignedUp }: Props) {
  const [draft, setDraft] = useState<RegistrationDraft>(EMPTY_REGISTRATION);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);

  const storeError = useAuthStore((s) => s.error);
  const signUp = useAuthStore((s) => s.signUp);

  const serverError = useMemo(
    () => (touched ? friendlyAuthError(storeError) : null),
    [touched, storeError],
  );

  const showSiret = needsSiret(role);

  const set = (key: keyof RegistrationDraft, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
    // L'erreur disparaît dès qu'on retouche le champ : la laisser affichée
    // pendant la correction donne l'impression que la saisie ne sert à rien.
    setErrors((e) => (e[key] ? { ...e, [key]: '' } : e));
  };

  const submit = async () => {
    const found = validateRegistration(draft);
    setTouched(true);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setErrors({});

    const profile = toProfile(draft);
    onSiretChange?.(profile.siret ?? '');

    setSubmitting(true);
    const result = await signUp(profile.email, draft.password);
    setSubmitting(false);
    if (result.ok) onSignedUp?.();
  };

  return (
    <Screen testID="sign-up-screen">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerClassName="flex-grow py-6"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-6">
            <AppText className="font-display text-ink" style={{ fontSize: 30, lineHeight: 38 }}>
              Créer mon compte
            </AppText>
            <View className="mt-2 flex-row items-center gap-2 self-start rounded-pill bg-brand-50 px-3 py-1.5">
              <Feather name="user-check" size={13} color={colors.brand600} />
              <AppText className="font-sans-semibold text-brand-700" style={{ fontSize: 12.5 }}>
                {ROLE_LABEL[role]}
              </AppText>
            </View>
          </View>

          <View className="gap-3.5">
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Field
                  testID="signup-firstname"
                  label="Prénom"
                  value={draft.firstName}
                  onChangeText={(v) => set('firstName', v)}
                  error={errors.firstName}
                  placeholder="Sofiane"
                  autoCapitalize="words"
                  textContentType="givenName"
                />
              </View>
              <View className="flex-1">
                <Field
                  testID="signup-lastname"
                  label="Nom"
                  value={draft.lastName}
                  onChangeText={(v) => set('lastName', v)}
                  error={errors.lastName}
                  placeholder="Terki"
                  autoCapitalize="words"
                  textContentType="familyName"
                />
              </View>
            </View>

            <Field
              testID="signup-email"
              label="Adresse e-mail"
              value={draft.email}
              onChangeText={(v) => set('email', v)}
              error={errors.email}
              placeholder="vous@exemple.fr"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
            />

            <Field
              testID="signup-phone"
              label="Numéro de téléphone"
              value={draft.phone}
              onChangeText={(v) => set('phone', v)}
              error={errors.phone}
              placeholder="06 12 34 56 78"
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
            />

            <Field
              testID="signup-location"
              label="Localisation"
              value={draft.location}
              onChangeText={(v) => set('location', v)}
              error={errors.location}
              placeholder="Toulouse"
              autoCapitalize="words"
              hint="Sert à vous montrer les offres autour de vous."
            />

            {showSiret ? (
              <Field
                testID="signup-siret"
                label="SIRET"
                value={draft.siret}
                onChangeText={(v) => set('siret', v)}
                error={errors.siret}
                placeholder="443 061 841 00047"
                keyboardType="number-pad"
                hint={
                  draft.siret.trim() === ''
                    ? 'Facultatif ici — demandé pour commander chez un grossiste.'
                    : formatSiret(draft.siret)
                }
              />
            ) : null}

            <Field
              testID="signup-password"
              label="Mot de passe"
              value={draft.password}
              onChangeText={(v) => set('password', v)}
              error={errors.password}
              placeholder="8 caractères minimum"
              secureTextEntry
              textContentType="newPassword"
            />

            <Field
              testID="signup-confirm"
              label="Confirmation du mot de passe"
              value={draft.confirm}
              onChangeText={(v) => set('confirm', v)}
              error={errors.confirm}
              placeholder="Le même, pour être sûr"
              secureTextEntry
              textContentType="newPassword"
            />

            {serverError ? (
              <View className="flex-row items-start gap-2 rounded-control border border-brand-200 bg-brand-50 p-3">
                <Feather name="alert-circle" size={15} color={colors.brand600} />
                <AppText testID="signup-error" variant="caption" className="flex-1 text-brand-600">
                  {serverError}
                </AppText>
              </View>
            ) : null}

            <View className="mt-1">
              <Button
                testID="signup-submit"
                label="Créer mon compte"
                loading={submitting}
                onPress={submit}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/* ---------------------------------------------------------------- morceaux */

type FieldProps = {
  testID: string;
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  error?: string | undefined;
  hint?: string;
} & Omit<React.ComponentProps<typeof TextField>, 'testID' | 'value' | 'onChangeText' | 'className'>;

function Field({ testID, label, value, onChangeText, error, hint, ...rest }: FieldProps) {
  return (
    <View className="gap-1.5">
      <AppText variant="caption" className="font-sans-semibold text-ink-muted">
        {label}
      </AppText>
      <View className="flex-row">
        <TextField
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          className={cn(error && 'border-brand-500')}
          {...rest}
        />
      </View>
      {error ? (
        <AppText testID={`${testID}-error`} variant="caption" className="text-brand-600">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" className="text-ink-faint" style={{ fontSize: 11.5 }}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

/** Lien « j'ai déjà un compte » — rendu par la route, qui connaît la navigation. */
export function SignUpFooterLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable testID="signup-to-signin" accessibilityRole="button" onPress={onPress}>
      <AppText variant="caption" className="text-center text-ink-muted">
        Vous avez déjà un compte ?{' '}
        <AppText className="font-sans-bold text-brand-600">Se connecter</AppText>
      </AppText>
    </Pressable>
  );
}
