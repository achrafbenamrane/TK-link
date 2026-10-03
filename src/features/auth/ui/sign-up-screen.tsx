import { Feather } from '@expo/vector-icons';
import { useMemo, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';

import { formatSiret, type Role } from '@/shared/lib/roles';
import { AppText, Button, Checkbox, Screen, TextField, ThemeToggle, Wordmark } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

import { friendlyAuthError } from '../model/auth-errors';
import {
  EMPTY_REGISTRATION,
  needsSiret,
  toProfile,
  validateRegistration,
  type RegistrationDraft,
} from '../model/registration';
import { useAuthStore } from '../model/store';
import { DemoNotice } from './demo-notice';

type Props = {
  /** Rôle — passé par la route (pas d'import inter-feature). */
  role: Role;
  /**
   * L'avatar cliquable du haut de formulaire (le « + » de la maquette). Fourni
   * par la route : la galerie vit dans `onboarding`, que `auth` ne connaît pas.
   */
  renderAvatar?: () => ReactNode;
  /** Ce que l'inscription apprend de la personne — à ranger côté profil local. */
  onProfile?: (profile: { firstName: string; siret: string }) => void;
  onSignedUp?: () => void;
  /** « J'ai déjà un compte » — la navigation reste à la route. */
  onSignIn?: () => void;
  /** « Continuer sans compte » — idem. */
  onSkip?: () => void;
};

/**
 * INSCRIPTION — le formulaire de la maquette du client, et celui du CDC §2.2.
 *
 * Prénom, nom, e-mail, téléphone, mot de passe + confirmation ; la
 * localisation est facultative (« selon consentement »), le SIRET n'apparaît que
 * pour un professionnel et reste facultatif ici (le CDC ne l'exige que pour
 * commander chez un grossiste). Les CGU et la politique de confidentialité
 * doivent être acceptées.
 *
 * Chaque erreur s'affiche sous son champ : un bandeau global oblige à chercher
 * lequel des champs corriger — ce qu'il ne faut pas faire sur un formulaire long.
 */
export function SignUpScreen({
  role,
  renderAvatar,
  onProfile,
  onSignedUp,
  onSignIn,
  onSkip,
}: Props) {
  const colors = useColors();
  const [draft, setDraft] = useState<RegistrationDraft>(EMPTY_REGISTRATION);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
    if (!accepted) found.terms = 'Acceptez les CGU et la politique de confidentialité.';
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setErrors({});

    const profile = toProfile(draft);
    onProfile?.({ firstName: profile.firstName, siret: profile.siret ?? '' });

    setSubmitting(true);
    const result = await signUp(profile.email, draft.password);
    setSubmitting(false);
    if (result.ok) onSignedUp?.();
  };

  const eye = (
    <Pressable
      testID="signup-eye"
      accessibilityRole="button"
      accessibilityLabel={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
      hitSlop={10}
      onPress={() => setShowPassword((v) => !v)}
    >
      <Feather name={showPassword ? 'eye-off' : 'eye'} size={17} color={colors.inkFaint} />
    </Pressable>
  );

  return (
    <Screen testID="sign-up-screen">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerClassName="flex-grow pb-8 pt-3"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-5 flex-row items-center justify-between">
            <Wordmark size={24} />
            <ThemeToggle />
          </View>

          <View className="mb-4 items-center gap-2">
            <AppText variant="display" className="text-center" style={{ fontSize: 26 }}>
              Créer mon compte
            </AppText>
            <AppText variant="caption" className="text-center">
              Inscris-toi pour accéder aux meilleures offres Flash autour de toi.
            </AppText>
          </View>

          {renderAvatar ? <View className="mb-4 items-center">{renderAvatar()}</View> : null}

          <DemoNotice />

          <View className="gap-3">
            <Field
              testID="signup-firstname"
              icon="user"
              value={draft.firstName}
              onChangeText={(v) => set('firstName', v)}
              error={errors.firstName}
              placeholder="Prénom"
              accessibilityLabel="Prénom"
              autoCapitalize="words"
              textContentType="givenName"
            />
            <Field
              testID="signup-lastname"
              icon="user"
              value={draft.lastName}
              onChangeText={(v) => set('lastName', v)}
              error={errors.lastName}
              placeholder="Nom"
              accessibilityLabel="Nom"
              autoCapitalize="words"
              textContentType="familyName"
            />
            <Field
              testID="signup-email"
              icon="mail"
              value={draft.email}
              onChangeText={(v) => set('email', v)}
              error={errors.email}
              placeholder="E-mail"
              accessibilityLabel="Adresse e-mail"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
            />
            <Field
              testID="signup-phone"
              icon="phone"
              value={draft.phone}
              onChangeText={(v) => set('phone', v)}
              error={errors.phone}
              placeholder="Téléphone"
              accessibilityLabel="Numéro de téléphone"
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
            />
            {showSiret ? (
              <Field
                testID="signup-siret"
                icon="file-text"
                value={draft.siret}
                onChangeText={(v) => set('siret', v)}
                error={errors.siret}
                placeholder="SIRET"
                accessibilityLabel="SIRET"
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
              icon="lock"
              value={draft.password}
              onChangeText={(v) => set('password', v)}
              error={errors.password}
              placeholder="Mot de passe"
              accessibilityLabel="Mot de passe"
              secureTextEntry={!showPassword}
              textContentType="newPassword"
              accessory={eye}
            />
            <Field
              testID="signup-confirm"
              icon="lock"
              value={draft.confirm}
              onChangeText={(v) => set('confirm', v)}
              error={errors.confirm}
              placeholder="Confirmer le mot de passe"
              accessibilityLabel="Confirmation du mot de passe"
              secureTextEntry={!showPassword}
              textContentType="newPassword"
            />
            <Field
              testID="signup-location"
              icon="map-pin"
              value={draft.location}
              onChangeText={(v) => set('location', v)}
              error={errors.location}
              placeholder="Ville / localisation (optionnel)"
              accessibilityLabel="Ville ou localisation, facultatif"
              autoCapitalize="words"
            />

            <View className="mt-1 gap-1.5">
              <Checkbox
                testID="signup-terms"
                checked={accepted}
                onChange={(v) => {
                  setAccepted(v);
                  if (v) setErrors((e) => ({ ...e, terms: '' }));
                }}
                invalid={!!errors.terms}
                accessibilityLabel="J’accepte les CGU et la politique de confidentialité"
              >
                <AppText variant="caption" className="text-ink-muted">
                  J’accepte les <AppText className="text-accent-deep">CGU</AppText> et la{' '}
                  <AppText className="text-brand-600">politique de confidentialité</AppText>.
                </AppText>
              </Checkbox>
              {errors.terms ? (
                <AppText testID="signup-terms-error" variant="caption" className="text-brand-600">
                  {errors.terms}
                </AppText>
              ) : null}
            </View>

            {serverError ? (
              <View className="flex-row items-start gap-2 rounded-control border border-brand-200 bg-brand-50 p-3">
                <Feather name="alert-circle" size={15} color={colors.brand600} />
                <AppText testID="signup-error" variant="caption" className="flex-1 text-brand-600">
                  {serverError}
                </AppText>
              </View>
            ) : null}

            <View className="mt-1 gap-2.5">
              <Button
                testID="signup-submit"
                label="Créer mon compte"
                loading={submitting}
                onPress={submit}
              />
              {onSignIn ? (
                <Button
                  testID="signup-to-signin"
                  label="J’ai déjà un compte"
                  variant="secondary"
                  onPress={onSignIn}
                />
              ) : null}
            </View>

            {onSkip ? (
              <Pressable
                testID="signup-skip"
                accessibilityRole="button"
                accessibilityLabel="Continuer sans compte"
                onPress={onSkip}
                className="items-center py-2"
              >
                <AppText variant="caption" className="text-ink-muted">
                  Continuer sans compte
                </AppText>
              </Pressable>
            ) : null}

            {/* La réassurance de la maquette : trois promesses que l'app tient. */}
            <View className="mt-2 flex-row justify-between">
              {(
                [
                  ['shield', 'Paiement sécurisé'],
                  ['lock', 'Données protégées'],
                  ['map-pin', 'Offres géolocalisées'],
                ] as const
              ).map(([icon, label]) => (
                <View key={label} className="flex-1 flex-row items-center justify-center gap-1.5">
                  <Feather name={icon} size={15} color={colors.brand500} />
                  <AppText variant="caption" style={{ fontSize: 11 }}>
                    {label}
                  </AppText>
                </View>
              ))}
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
  error?: string | undefined;
  hint?: string;
} & Omit<React.ComponentProps<typeof TextField>, 'testID' | 'className' | 'invalid'>;

function Field({ testID, error, hint, ...rest }: FieldProps) {
  return (
    <View className="gap-1">
      <View className="flex-row">
        <TextField testID={testID} invalid={!!error} {...rest} />
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

/** Lien « j'ai déjà un compte » — conservé pour les routes qui le composent seules. */
export function SignUpFooterLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable testID="signup-footer-signin" accessibilityRole="button" onPress={onPress}>
      <AppText variant="caption" className="text-center text-ink-muted">
        Vous avez déjà un compte ?{' '}
        <AppText className="font-sans-bold text-brand-600">Se connecter</AppText>
      </AppText>
    </Pressable>
  );
}
