import { Feather } from '@expo/vector-icons';
import { useMemo, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { CATEGORIES, CATEGORY_INFO, type Category } from '@/shared/lib/categories';
import { PLATFORM_SETTINGS } from '@/shared/lib/platform-settings';
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

/** Les deux façons de livrer — « Sur place » n'existe pas dans le CDC. */
export type ShopMode = 'touch-collect' | 'livraison';

export type SignUpProfile = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  siret: string;
  location: string;
  /** Professionnels seulement. */
  shopName: string;
  category: Category | '';
  address: string;
  modes: ShopMode[];
};

type Props = {
  /** Rôle — passé par la route (pas d'import inter-feature). */
  role: Role;
  /**
   * L'avatar cliquable du haut de formulaire (le « + » de la maquette). Fourni
   * par la route : la galerie vit dans `onboarding`, que `auth` ne connaît pas.
   * Un professionnel n'en a pas : son logo viendra avec le serveur.
   */
  renderAvatar?: () => ReactNode;
  /** Bascule Commerçant ⇄ Grossiste, pour un professionnel. */
  onRoleChange?: (role: Role) => void;
  /** Ce que l'inscription apprend de la personne — à ranger côté profil local. */
  onProfile?: (profile: SignUpProfile) => void;
  onSignedUp?: () => void;
  /** « J'ai déjà un compte » — la navigation reste à la route. */
  onSignIn?: () => void;
  /** « Continuer sans compte » — idem (consommateurs seulement). */
  onSkip?: () => void;
};

const MODE_LABEL: Record<ShopMode, string> = {
  'touch-collect': 'Touch & Collect',
  livraison: 'Livraison',
};

const PRO_TITLE: Record<'commercant' | 'grossiste', { title: string; subtitle: string }> = {
  commercant: {
    title: 'Créer mon compte commerçant',
    subtitle: 'Rejoignez TKLINK pour publier vos opérations Flash en temps réel.',
  },
  grossiste: {
    title: 'Créer mon compte grossiste',
    subtitle: 'Rejoignez TKLINK pour proposer vos lots aux commerçants.',
  },
};

/**
 * INSCRIPTION — le formulaire de la maquette du client, et celui du CDC §2.2.
 *
 * Prénom, nom, e-mail, téléphone, mot de passe + confirmation ; la
 * localisation est facultative (« selon consentement »). Un professionnel y
 * ajoute le nom de son commerce, sa catégorie, son adresse et ses modes de
 * remise ; son SIRET reste facultatif ici (le CDC ne l'exige que pour publier ou
 * commander en B2B). Les CGU et la politique de confidentialité doivent être
 * acceptées.
 *
 * Chaque erreur s'affiche sous son champ : un bandeau global oblige à chercher
 * lequel des champs corriger — ce qu'il ne faut pas faire sur un formulaire long.
 */
export function SignUpScreen({
  role,
  renderAvatar,
  onRoleChange,
  onProfile,
  onSignedUp,
  onSignIn,
  onSkip,
}: Props) {
  const colors = useColors();
  const [draft, setDraft] = useState<RegistrationDraft>(EMPTY_REGISTRATION);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [accepted, setAccepted] = useState(false);
  const [modes, setModes] = useState<ShopMode[]>(['touch-collect']);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // Un professionnel a deux étapes sur la même page : lui, puis son commerce. Chaque
  // écran tient sans défilement.
  const [step, setStep] = useState<1 | 2>(1);

  const storeError = useAuthStore((s) => s.error);
  const signUp = useAuthStore((s) => s.signUp);

  const serverError = useMemo(
    () => (touched ? friendlyAuthError(storeError) : null),
    [touched, storeError],
  );

  const pro = needsSiret(role);
  const courier = role === 'livreur';
  const proCopy = PRO_TITLE[role === 'grossiste' ? 'grossiste' : 'commercant'];

  const set = (key: keyof RegistrationDraft, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
    // L'erreur disparaît dès qu'on retouche le champ : la laisser affichée
    // pendant la correction donne l'impression que la saisie ne sert à rien.
    setErrors((e) => (e[key] ? { ...e, [key]: '' } : e));
  };

  const toggleMode = (mode: ShopMode) =>
    setModes((current) =>
      current.includes(mode) ? current.filter((m) => m !== mode) : [...current, mode],
    );

  const STEP1_KEYS = ['firstName', 'lastName', 'email', 'phone', 'password', 'confirm'];
  const next = () => {
    const found = validateRegistration(draft, role);
    const mine = Object.fromEntries(Object.entries(found).filter(([k]) => STEP1_KEYS.includes(k)));
    setErrors(mine);
    if (Object.keys(mine).length === 0) setStep(2);
  };

  const submit = async () => {
    const found = validateRegistration(draft, role);
    setTouched(true);
    if (pro && modes.length === 0) found.modes = 'Choisissez au moins un mode de remise.';
    if (!accepted) found.terms = 'Acceptez les CGU et la politique de confidentialité.';
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setErrors({});

    const profile = toProfile(draft);
    onProfile?.({
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      phone: profile.phone,
      siret: profile.siret ?? '',
      location: profile.location,
      shopName: profile.shopName,
      category: profile.category as Category | '',
      address: profile.address,
      modes,
    });

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
          contentContainerClassName="flex-grow justify-between pb-3 pt-1"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-2 flex-row items-center justify-between">
            <Wordmark size={24} />
            <ThemeToggle />
          </View>

          <View className="mb-2 items-center gap-1">
            <AppText variant="display" className="text-center" style={{ fontSize: 22 }}>
              {pro ? proCopy.title : courier ? 'Créer mon compte livreur' : 'Créer mon compte'}
            </AppText>
            <AppText variant="caption" className="text-center">
              {pro
                ? proCopy.subtitle
                : courier
                  ? 'Rejoignez TK Deliver pour livrer les commandes de votre quartier.'
                  : 'Inscris-toi pour accéder aux offres Flash autour de toi.'}
            </AppText>
          </View>

          {pro ? (
            <View className="mb-2 items-center">
              <View className="h-14 w-14 items-center justify-center rounded-pill border-2 border-brand-500">
                <Feather name="shopping-bag" size={24} color={colors.brand500} />
              </View>
            </View>
          ) : renderAvatar ? (
            <View className="mb-2 items-center">{renderAvatar()}</View>
          ) : null}

          {pro && onRoleChange ? (
            <View
              accessibilityRole="tablist"
              className="mb-2 flex-row rounded-control border border-line bg-surface-muted p-0.5"
            >
              {(['commercant', 'grossiste'] as const).map((r) => {
                const active = role === r;
                return (
                  <Pressable
                    key={r}
                    testID={`signup-role-${r}`}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    onPress={() => onRoleChange(r)}
                    className={cn(
                      'flex-1 items-center rounded-lg py-2.5',
                      active && 'border border-brand-500 bg-brand-50',
                    )}
                  >
                    <AppText
                      className={cn(
                        'font-sans-semibold',
                        active ? 'text-brand-600' : 'text-ink-muted',
                      )}
                      style={{ fontSize: 13.5 }}
                    >
                      {r === 'commercant' ? 'Commerçant' : 'Grossiste'}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <DemoNotice compact />

          <View className="gap-1.5">
            {!pro || step === 1 ? (
              <>
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
                  placeholder={pro ? 'E-mail professionnel' : 'E-mail'}
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
              </>
            ) : null}

            {pro && step === 2 ? (
              <>
                <Field
                  testID="signup-shopname"
                  icon="shopping-bag"
                  value={draft.shopName}
                  onChangeText={(v) => set('shopName', v)}
                  error={errors.shopName}
                  placeholder="Nom du commerce"
                  accessibilityLabel="Nom du commerce"
                  autoCapitalize="words"
                />

                <View className="gap-1.5">
                  <AppText variant="caption" className="font-sans-semibold text-ink-muted">
                    Catégorie
                  </AppText>
                  <View className="flex-row flex-wrap gap-2">
                    {CATEGORIES.map((key) => {
                      const on = draft.category === key;
                      return (
                        <Pressable
                          key={key}
                          testID={`signup-category-${key}`}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on }}
                          accessibilityLabel={CATEGORY_INFO[key].label}
                          onPress={() => set('category', key)}
                          className={cn(
                            'rounded-pill border px-3 py-2',
                            on ? 'border-brand-500 bg-brand-500' : 'border-line bg-surface-muted',
                          )}
                        >
                          <AppText
                            className={cn(
                              'font-sans-semibold',
                              on ? 'text-ink-inverse' : 'text-ink-muted',
                            )}
                            style={{ fontSize: 12 }}
                          >
                            {CATEGORY_INFO[key].label}
                          </AppText>
                        </Pressable>
                      );
                    })}
                  </View>
                  {errors.category ? (
                    <AppText
                      testID="signup-category-error"
                      variant="caption"
                      className="text-brand-600"
                    >
                      {errors.category}
                    </AppText>
                  ) : null}
                </View>

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
                      ? 'Vérifié avant toute publication ou commande B2B.'
                      : formatSiret(draft.siret)
                  }
                />
                <Field
                  testID="signup-address"
                  icon="home"
                  value={draft.address}
                  onChangeText={(v) => set('address', v)}
                  error={errors.address}
                  placeholder="Adresse"
                  accessibilityLabel="Adresse du commerce"
                  autoCapitalize="words"
                  textContentType="fullStreetAddress"
                />
              </>
            ) : null}

            {!pro || step === 2 ? (
              <Field
                testID="signup-location"
                icon="map-pin"
                value={draft.location}
                onChangeText={(v) => set('location', v)}
                error={errors.location}
                placeholder={pro ? 'Ville / localisation' : 'Ville / localisation (optionnel)'}
                accessibilityLabel={
                  pro ? 'Ville ou localisation' : 'Ville ou localisation, facultatif'
                }
                autoCapitalize="words"
              />
            ) : null}

            {pro && step === 2 ? (
              <View className="gap-1.5">
                <View className="flex-row gap-2">
                  {(['touch-collect', 'livraison'] as const).map((m) => {
                    const on = modes.includes(m);
                    return (
                      <Pressable
                        key={m}
                        testID={`signup-mode-${m}`}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on }}
                        accessibilityLabel={MODE_LABEL[m]}
                        onPress={() => toggleMode(m)}
                        className={cn(
                          'flex-1 flex-row items-center justify-center gap-2 rounded-control border py-3',
                          on ? 'border-brand-500 bg-brand-50' : 'border-line bg-surface-muted',
                        )}
                      >
                        <Feather
                          name={on ? 'check-circle' : m === 'livraison' ? 'truck' : 'shopping-bag'}
                          size={15}
                          color={on ? colors.brand600 : colors.inkMuted}
                        />
                        <AppText
                          className={cn(
                            'font-sans-semibold',
                            on ? 'text-brand-600' : 'text-ink-muted',
                          )}
                          style={{ fontSize: 13 }}
                        >
                          {MODE_LABEL[m]}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
                {errors.modes ? (
                  <AppText testID="signup-modes-error" variant="caption" className="text-brand-600">
                    {errors.modes}
                  </AppText>
                ) : null}
              </View>
            ) : null}

            {!pro || step === 2 ? (
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
                  <AppText variant="caption" className="text-ink-muted" style={{ fontSize: 11.5 }}>
                    J’accepte les{' '}
                    <AppText className="text-accent-deep" style={{ fontSize: 11.5 }}>
                      CGU
                    </AppText>{' '}
                    et la{' '}
                    <AppText className="text-brand-600" style={{ fontSize: 11.5 }}>
                      politique de confidentialité
                    </AppText>
                    .
                  </AppText>
                </Checkbox>
                {errors.terms ? (
                  <AppText testID="signup-terms-error" variant="caption" className="text-brand-600">
                    {errors.terms}
                  </AppText>
                ) : null}
              </View>
            ) : null}

            {serverError ? (
              <View className="flex-row items-start gap-2 rounded-control border border-brand-200 bg-brand-50 p-3">
                <Feather name="alert-circle" size={15} color={colors.brand600} />
                <AppText testID="signup-error" variant="caption" className="flex-1 text-brand-600">
                  {serverError}
                </AppText>
              </View>
            ) : null}

            <View className="mt-1 gap-2.5">
              {pro && step === 1 ? (
                <Button testID="signup-next" label="Continuer" onPress={next} />
              ) : (
                <Button
                  testID="signup-submit"
                  label="Créer mon compte"
                  loading={submitting}
                  onPress={submit}
                />
              )}
              {onSignIn ? (
                <Button
                  testID="signup-to-signin"
                  label="J’ai déjà un compte"
                  variant="secondary"
                  onPress={onSignIn}
                />
              ) : null}
            </View>

            {pro ? (
              <View
                testID="signup-free-ops"
                className="flex-row items-center justify-center gap-2 rounded-control border border-line bg-surface-muted py-3"
              >
                <Feather name="gift" size={15} color={colors.brand500} />
                <AppText variant="caption" className="text-ink-muted">
                  <AppText className="font-sans-bold text-ink">
                    {PLATFORM_SETTINGS.freeOperations} opérations Flash
                  </AppText>{' '}
                  gratuites pour démarrer
                </AppText>
              </View>
            ) : onSkip ? (
              <Pressable
                testID="signup-skip"
                accessibilityRole="button"
                accessibilityLabel="Continuer sans compte"
                onPress={onSkip}
                className="items-center py-1"
              >
                <AppText variant="caption" className="text-ink-muted">
                  Continuer sans compte
                </AppText>
              </Pressable>
            ) : null}

            {/* La réassurance de la maquette : trois promesses que l'app tient. */}
            <View className="mt-1 flex-row justify-between">
              {(pro
                ? ([
                    ['zap', 'Publication rapide'],
                    ['shield', 'Données sécurisées'],
                    ['map-pin', 'Visibilité locale'],
                  ] as const)
                : ([
                    ['shield', 'Paiement sécurisé'],
                    ['lock', 'Données protégées'],
                    ['map-pin', 'Offres géolocalisées'],
                  ] as const)
              ).map(([icon, label]) => (
                <View key={label} className="flex-1 flex-row items-center justify-center gap-1.5">
                  <Feather name={icon} size={15} color={colors.brand500} />
                  <AppText variant="caption" style={{ fontSize: 10 }}>
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
    <View className="gap-0.5">
      <View className="flex-row">
        <TextField testID={testID} invalid={!!error} compact {...rest} />
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
