import { Feather } from '@expo/vector-icons';
import { useMemo, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { CATEGORIES, CATEGORY_INFO, type Category } from '@/shared/lib/categories';
import { PLATFORM_SETTINGS } from '@/shared/lib/platform-settings';
import { type Role } from '@/shared/lib/roles';
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
  /** Ce que l'inscription apprend de la personne — à ranger côté profil local. */
  onProfile?: (profile: SignUpProfile) => void;
  onSignedUp?: () => void;
  /** « J'ai déjà un compte » — la navigation reste à la route. */
  onSignIn?: () => void;
  /** « Continuer sans compte » — idem (consommateurs seulement). */
  onSkip?: () => void;
  /** Flèche retour (maquette professionnelle) — vers le choix du profil. */
  onBack?: () => void;
  /**
   * Un formulaire déjà REMPLI — pour la démonstration : on arrive sur l'inscription avec
   * tout d'écrit, il n'y a plus qu'à valider. Absent : formulaire vierge.
   */
  initialDraft?: Partial<RegistrationDraft>;
  /** Cocher d'avance les CGU (démonstration). */
  initialAccepted?: boolean;
};

const MODE_LABEL: Record<ShopMode, string> = {
  'touch-collect': 'Touch & Collect',
  livraison: 'Livraison',
};

/** Un grossiste retire ou expédie : « Touch & Collect » est le mot du commerce. */
const WHOLESALE_MODE_LABEL: Record<ShopMode, string> = {
  'touch-collect': 'Retrait',
  livraison: 'Expédition',
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
 * Prénom, nom, e-mail, téléphone, mot de passe + confirmation ; la localisation est
 * facultative (« selon consentement »). Un professionnel y ajoute le nom de son
 * commerce, sa catégorie, son SIRET (facultatif ici : le CDC ne l'exige que pour
 * publier ou commander en B2B), son adresse et ses modes de remise. Les CGU et la
 * politique de confidentialité doivent être acceptées.
 *
 * TOUT TIENT SUR UNE PAGE, sans défilement, comme les maquettes : des champs de 36 px
 * pour les professionnels (douze champs), la catégorie en liste déroulante.
 *
 * Chaque erreur s'affiche sous son champ : un bandeau global oblige à chercher
 * lequel des champs corriger.
 */
export function SignUpScreen({
  role,
  renderAvatar,
  onProfile,
  onSignedUp,
  onSignIn,
  onSkip,
  onBack,
  initialDraft,
  initialAccepted = false,
}: Props) {
  const colors = useColors();
  const [draft, setDraft] = useState<RegistrationDraft>({
    ...EMPTY_REGISTRATION,
    ...initialDraft,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [accepted, setAccepted] = useState(initialAccepted);
  const [modes, setModes] = useState<ShopMode[]>(['touch-collect']);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const storeError = useAuthStore((s) => s.error);
  const signUp = useAuthStore((s) => s.signUp);

  const serverError = useMemo(
    () => (touched ? friendlyAuthError(storeError) : null),
    [touched, storeError],
  );

  const pro = needsSiret(role);
  const courier = role === 'livreur';
  const proCopy = PRO_TITLE[role === 'grossiste' ? 'grossiste' : 'commercant'];
  const modeLabel = role === 'grossiste' ? WHOLESALE_MODE_LABEL : MODE_LABEL;
  const dense = pro;
  const [notice, setNotice] = useState<string | null>(null);

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
      <Feather name={showPassword ? 'eye-off' : 'eye'} size={16} color={colors.inkFaint} />
    </Pressable>
  );

  /** Les champs communs — l'ordre des maquettes change entre client et professionnel. */
  const firstName = (
    <Field
      key="firstname"
      dense={dense}
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
  );
  const lastName = (
    <Field
      key="lastname"
      dense={dense}
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
  );
  const email = (
    <Field
      key="email"
      dense={dense}
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
  );
  const phone = (
    <Field
      key="phone"
      dense={dense}
      testID="signup-phone"
      icon="phone"
      prefix={
        <View className="flex-row items-center gap-1 border-x border-line px-2">
          <AppText style={{ fontSize: 13 }}>🇫🇷</AppText>
          <Feather name="chevron-down" size={11} color={colors.inkFaint} />
        </View>
      }
      value={draft.phone}
      onChangeText={(v) => set('phone', v)}
      error={errors.phone}
      placeholder="Téléphone"
      accessibilityLabel="Numéro de téléphone"
      keyboardType="phone-pad"
      textContentType="telephoneNumber"
    />
  );
  const location = (
    <Field
      key="location"
      dense={dense}
      testID="signup-location"
      icon="map-pin"
      value={draft.location}
      onChangeText={(v) => set('location', v)}
      error={errors.location}
      placeholder={pro ? 'Ville / Localisation' : 'Ville / localisation (optionnel)'}
      accessibilityLabel={pro ? 'Ville ou localisation' : 'Ville ou localisation, facultatif'}
      autoCapitalize="words"
    />
  );
  const passwords = [
    <Field
      key="password"
      dense={dense}
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
    />,
    <Field
      key="confirm"
      dense={dense}
      testID="signup-confirm"
      icon="lock"
      value={draft.confirm}
      onChangeText={(v) => set('confirm', v)}
      error={errors.confirm}
      placeholder="Confirmer le mot de passe"
      accessibilityLabel="Confirmation du mot de passe"
      secureTextEntry={!showPassword}
      textContentType="newPassword"
    />,
  ];

  return (
    <Screen testID="sign-up-screen">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-between pb-2 pt-1"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Retour · logo · Nuit/Jour — l'en-tête de la maquette professionnelle */}
          <View className="mb-1.5 flex-row items-center justify-between">
            {pro && onBack ? (
              <Pressable
                testID="signup-back"
                accessibilityRole="button"
                accessibilityLabel="Retour"
                hitSlop={10}
                onPress={onBack}
                className="w-16"
              >
                <Feather name="arrow-left" size={22} color={colors.ink} />
              </Pressable>
            ) : (
              <View className="w-16" />
            )}
            <Wordmark size={pro ? 22 : 26} />
            <View className={cn('w-16 items-end')}>{pro ? <ThemeToggle /> : null}</View>
          </View>

          <View className="mb-1.5 items-center gap-0.5">
            <AppText variant="display" className="text-center" style={{ fontSize: 21 }}>
              {pro ? proCopy.title : courier ? 'Créer mon compte livreur' : 'Créer mon compte'}
            </AppText>
            <AppText variant="caption" className="text-center" style={{ fontSize: 12 }}>
              {pro
                ? proCopy.subtitle
                : courier
                  ? 'Rejoignez TK Deliver pour livrer les commandes de votre quartier.'
                  : 'Inscris-toi pour accéder aux meilleures offres Flash autour de toi.'}
            </AppText>
          </View>

          {pro ? (
            <View className="mb-1.5 items-center">
              <View className="h-10 w-10 items-center justify-center rounded-pill border-2 border-brand-500">
                <Feather name="shopping-bag" size={19} color={colors.brand500} />
                <View className="absolute -bottom-0.5 -right-0.5 h-5 w-5 items-center justify-center rounded-pill bg-brand-500">
                  <Feather name="plus" size={12} color="#FFFFFF" />
                </View>
              </View>
            </View>
          ) : renderAvatar ? (
            <View className="mb-1.5 items-center">{renderAvatar()}</View>
          ) : null}

          <View className={dense ? 'gap-1' : 'gap-1.5'}>
            {firstName}
            {lastName}
            {email}
            {phone}

            {pro ? (
              <>
                <Field
                  dense
                  testID="signup-shopname"
                  icon="shopping-bag"
                  value={draft.shopName}
                  onChangeText={(v) => set('shopName', v)}
                  error={errors.shopName}
                  placeholder="Nom du commerce"
                  accessibilityLabel="Nom du commerce"
                  autoCapitalize="words"
                />
                <CategorySelect
                  value={draft.category}
                  error={errors.category}
                  onChange={(key) => set('category', key)}
                />
                <Field
                  dense
                  testID="signup-siret"
                  icon="file-text"
                  value={draft.siret}
                  onChangeText={(v) => set('siret', v)}
                  error={errors.siret}
                  placeholder="SIRET"
                  accessibilityLabel="SIRET"
                  keyboardType="number-pad"
                />
                <Field
                  dense
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
                {location}
                {passwords}
              </>
            ) : (
              <>
                {passwords}
                {location}
              </>
            )}

            {pro ? (
              <View className="gap-1">
                <View className="flex-row gap-2">
                  {(['touch-collect', 'livraison'] as const).map((m) => {
                    const on = modes.includes(m);
                    return (
                      <Pressable
                        key={m}
                        testID={`signup-mode-${m}`}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on }}
                        accessibilityLabel={modeLabel[m]}
                        onPress={() => toggleMode(m)}
                        className={cn(
                          'h-9 flex-1 flex-row items-center justify-center gap-1.5 rounded-control border',
                          on ? 'border-brand-500 bg-brand-50' : 'border-line bg-surface-muted',
                        )}
                      >
                        <Feather
                          name={on ? 'check-circle' : m === 'livraison' ? 'truck' : 'shopping-bag'}
                          size={14}
                          color={on ? colors.brand600 : colors.inkMuted}
                        />
                        <AppText
                          className={cn(
                            'font-sans-semibold',
                            on ? 'text-brand-600' : 'text-ink-muted',
                          )}
                          style={{ fontSize: 12 }}
                        >
                          {modeLabel[m]}
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

            <View className="gap-1">
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

            {serverError ? (
              <View className="flex-row items-start gap-2 rounded-control border border-brand-200 bg-brand-50 p-2.5">
                <Feather name="alert-circle" size={14} color={colors.brand600} />
                <AppText testID="signup-error" variant="caption" className="flex-1 text-brand-600">
                  {serverError}
                </AppText>
              </View>
            ) : null}

            <View className="gap-1.5">
              <Button
                testID="signup-submit"
                label={pro ? proCopy.title : 'Créer mon compte'}
                loading={submitting}
                onPress={submit}
                className={pro ? 'h-10' : undefined}
              />
              {onSignIn ? (
                <Button
                  testID="signup-to-signin"
                  label="J’ai déjà un compte"
                  variant="secondary"
                  onPress={onSignIn}
                  className={pro ? 'h-10' : undefined}
                />
              ) : null}
            </View>

            {role === 'commercant' ? (
              <View
                testID="signup-free-ops"
                className="flex-row items-center justify-center gap-2 rounded-control border border-line bg-surface-muted py-1"
              >
                <Feather name="gift" size={14} color={colors.brand500} />
                <AppText variant="caption" className="text-ink-muted" style={{ fontSize: 11.5 }}>
                  <AppText className="font-sans-bold text-ink" style={{ fontSize: 11.5 }}>
                    {PLATFORM_SETTINGS.freeOperations} opérations Flash
                  </AppText>{' '}
                  gratuites pour démarrer
                </AppText>
              </View>
            ) : (
              <View testID="signup-alternatives" className="gap-1.5">
                <View className="flex-row items-center gap-3">
                  <View className="h-px flex-1 bg-line" />
                  <AppText variant="caption" className="text-ink-muted" style={{ fontSize: 12 }}>
                    Continuer autrement
                  </AppText>
                  <View className="h-px flex-1 bg-line" />
                </View>
                <View className="flex-row gap-3">
                  {(
                    [
                      ['mail', 'Continuer avec une adresse e-mail', () => onSignIn?.()],
                      [
                        'smartphone',
                        'Continuer avec un numéro de téléphone',
                        () => setNotice('La connexion par téléphone arrive bientôt.'),
                      ],
                      ['user', 'Continuer sans compte', () => onSkip?.()],
                    ] as const
                  ).map(([icon, label, onPress]) => (
                    <Pressable
                      key={icon}
                      testID={icon === 'user' ? 'signup-skip' : `signup-alt-${icon}`}
                      accessibilityRole="button"
                      accessibilityLabel={label}
                      onPress={onPress}
                      className="h-10 flex-1 items-center justify-center rounded-control border border-line bg-surface-muted active:opacity-70"
                    >
                      <Feather name={icon} size={19} color={colors.brand500} />
                    </Pressable>
                  ))}
                </View>
                {notice ? (
                  <AppText
                    testID="signup-notice"
                    variant="caption"
                    className="text-center text-ink-faint"
                  >
                    {notice}
                  </AppText>
                ) : null}
              </View>
            )}

            {/* La réassurance de la maquette : trois promesses que l'app tient. */}
            <View className="flex-row justify-between pt-1">
              {(pro
                ? ([
                    ['zap', 'Publication\nrapide'],
                    ['shield', 'Données\nsécurisées'],
                    ['map-pin', 'Visibilité\nlocale'],
                  ] as const)
                : ([
                    ['shield', 'Paiement\nsécurisé'],
                    ['lock', 'Données\nprotégées'],
                    ['map-pin', 'Offres\ngéolocalisées'],
                  ] as const)
              ).map(([icon, label]) => (
                <View key={label} className="flex-1 flex-row items-center justify-center gap-2">
                  <View className="h-8 w-8 items-center justify-center rounded-pill border border-brand-200 bg-brand-50">
                    <Feather name={icon} size={15} color={colors.brand500} />
                  </View>
                  <AppText variant="caption" style={{ fontSize: 10.5, lineHeight: 13 }}>
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
  /** Hauteur de 36 px, pour le formulaire professionnel qui tient sur une page. */
  dense?: boolean;
} & Omit<React.ComponentProps<typeof TextField>, 'testID' | 'className' | 'invalid'>;

function Field({ testID, error, hint, dense, ...rest }: FieldProps) {
  return (
    <View className="gap-0.5">
      <View className="flex-row">
        <TextField testID={testID} invalid={!!error} compact dense={!!dense} {...rest} />
      </View>
      {error ? (
        <AppText testID={`${testID}-error`} variant="caption" className="text-brand-600">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" className="text-ink-faint" style={{ fontSize: 11 }}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

/**
 * La catégorie du commerce, en LISTE DÉROULANTE comme la maquette : un champ qui en
 * montre la valeur, et dont les choix s'ouvrent dessous. Les puces occupaient trois
 * lignes — impossible de tenir sur une page.
 */
function CategorySelect({
  value,
  error,
  onChange,
}: {
  value: string;
  error?: string | undefined;
  onChange: (key: Category) => void;
}) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const label = value && value in CATEGORY_INFO ? CATEGORY_INFO[value as Category].label : '';

  return (
    <View className="gap-0.5">
      <Pressable
        testID="signup-category-open"
        accessibilityRole="button"
        accessibilityLabel={label ? `Catégorie : ${label}` : 'Choisir une catégorie'}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        className={cn(
          'h-9 flex-row items-center gap-2.5 rounded-control border bg-surface-muted px-3.5',
          error ? 'border-brand-500' : 'border-line',
        )}
      >
        <Feather name="tag" size={15} color={colors.brand500} />
        <AppText
          className={cn('flex-1', label ? 'text-ink' : 'text-ink-faint')}
          style={{ fontSize: 13 }}
        >
          {label || 'Catégorie'}
        </AppText>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.inkMuted} />
      </Pressable>
      {open ? (
        <View
          testID="signup-category-list"
          className="rounded-control border border-line bg-surface-muted"
        >
          {CATEGORIES.map((key) => {
            const on = value === key;
            return (
              <Pressable
                key={key}
                testID={`signup-category-${key}`}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={CATEGORY_INFO[key].label}
                onPress={() => {
                  onChange(key);
                  setOpen(false);
                }}
                className="flex-row items-center justify-between px-3.5 py-2.5"
              >
                <AppText
                  className={on ? 'font-sans-bold text-brand-500' : 'text-ink'}
                  style={{ fontSize: 13 }}
                >
                  {CATEGORY_INFO[key].label}
                </AppText>
                {on ? <Feather name="check" size={15} color={colors.brand500} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {error ? (
        <AppText testID="signup-category-error" variant="caption" className="text-brand-600">
          {error}
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
