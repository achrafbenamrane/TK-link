import { Feather } from '@expo/vector-icons';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { CATEGORIES, CATEGORY_INFO, type Category } from '@/shared/lib/categories';
import { isPhoneAuthEnabled } from '@/shared/lib/env';
import { PLATFORM_SETTINGS } from '@/shared/lib/platform-settings';
import { type Role } from '@/shared/lib/roles';
import { AppText, BrandBar, Button, Checkbox, Screen, ScreenIntro, TextField } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

import { friendlyAuthError } from '../model/auth-errors';
import {
  EMPTY_REGISTRATION,
  needsPhone,
  needsSiret,
  toProfile,
  validateRegistration,
  type RegistrationDraft,
} from '../model/registration';
import type { SocialProvider } from '../model/social/types';
import { selectDemoMode, useAuthStore } from '../model/store';
import { SocialButton, useSocialAvailability } from './social-buttons';
import { needsFollowUp, SignUpVerification } from './sign-up-verification';

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
  /**
   * Le compte existe (et son numéro est associé) : la route aligne le type de compte avec le serveur,
   * puis enchaîne sur l'accueil. Le bouton garde son indicateur de chargement jusqu'au bout.
   */
  onSignedUp?: () => void | Promise<void>;
  /** « J'ai déjà un compte » — la navigation reste à la route. */
  onSignIn?: () => void;
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
 * L'écran DÉFILE, et c'est voulu (retour du 13/11/2026) : tout faire tenir sur une page, comme les
 * maquettes, imposait des champs de 36 px et des textes de 11 px — sur un Android, l'inscription
 * était tassée et rien ne s'alignait. Les champs ont la hauteur de ceux de la connexion (48 px), le
 * formulaire professionnel est rangé en trois groupes (coordonnées, commerce, mot de passe), et
 * l'en-tête « retour · logo · Nuit/Jour » est celui de tous les écrans d'entrée (`BrandBar`). La
 * catégorie reste une liste déroulante.
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
  const [socialBusy, setSocialBusy] = useState<SocialProvider | null>(null);
  /** Après l'inscription : le code à saisir, puis le numéro à vérifier. `null` : on montre le formulaire. */
  const [verification, setVerification] = useState<{
    email: string;
    phone: string;
    needsEmailCode: boolean;
  } | null>(null);

  const storeError = useAuthStore((s) => s.error);
  const demoMode = useAuthStore(selectDemoMode);
  const signUp = useAuthStore((s) => s.signUp);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const signInWithApple = useAuthStore((s) => s.signInWithApple);
  const linkPhone = useAuthStore((s) => s.linkPhone);
  const saveContactPhone = useAuthStore((s) => s.saveContactPhone);
  const available = useSocialAvailability();
  // Une seule création de compte à la fois : « Créer mon compte » pendant que Google est ouvert (ou
  // deux appuis dans la même image) lancerait deux inscriptions en parallèle.
  const creating = useRef(false);

  const serverError = useMemo(
    () => (touched ? friendlyAuthError(storeError) : null),
    [touched, storeError],
  );

  const pro = needsSiret(role);
  const proCopy = PRO_TITLE[role === 'grossiste' ? 'grossiste' : 'commercant'];
  const modeLabel = role === 'grossiste' ? WHOLESALE_MODE_LABEL : MODE_LABEL;

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
    if (creating.current) return;
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
    creating.current = true;
    setSubmitting(true);
    const result = await signUp(profile.email, draft.password, {
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.phoneE164,
      accountType: role,
    });
    if (!result.ok) {
      creating.current = false;
      setSubmitting(false);
      return;
    }

    // Le profil local (et, pour un professionnel, la fiche du commerce) n'est rangé qu'une fois le
    // compte CRÉÉ : un échec (adresse déjà inscrite…) ne doit rien laisser derrière lui.
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
    await continueAfterAccount(profile.email, profile.phoneE164, result.needsCode);
    creating.current = false;
    setSubmitting(false);
  };

  /**
   * Après la création du compte : le code e-mail s'il est exigé, puis l'association du numéro.
   * En démonstration, le numéro est déjà rangé dans la session (par l'inscription, ou juste après
   * Google et Apple) : rien à associer.
   */
  const continueAfterAccount = async (email: string, phone: string, needsEmailCode: boolean) => {
    const phoneEnabled = isPhoneAuthEnabled && !demoMode;
    if (needsFollowUp({ needsEmailCode, phone, phoneEnabled })) {
      setVerification({ email, phone, needsEmailCode });
      return;
    }
    await onSignedUp?.();
  };

  /**
   * « Continuer avec Google / Apple ». Créer un compte, c'est accepter les CGU : la case reste
   * obligatoire ici aussi. Un PROFESSIONNEL (grossiste, commerçant) remplit aussi la fiche de son
   * entreprise et son numéro de contact, comme par e-mail : Google et Apple donnent l'identité de la
   * personne, pas celle du commerce. Le reste du formulaire (nom, e-mail, mot de passe) n'est pas
   * exigé — le fournisseur donne déjà l'identité, et la personne n'a pas à inventer un mot de passe
   * de plus. Un numéro tapé par un particulier doit seulement être valide.
   */
  const social = async (provider: SocialProvider) => {
    if (creating.current) return;
    const found: Record<string, string> = {};
    if (!accepted) found.terms = 'Acceptez les CGU et la politique de confidentialité.';
    const all = validateRegistration(draft, role);
    if (pro) {
      for (const key of ['shopName', 'category', 'address', 'siret', 'phone'] as const) {
        if (all[key]) found[key] = all[key];
      }
      if (modes.length === 0) found.modes = 'Choisissez au moins un mode de remise.';
    } else if ((needsPhone(role) || draft.phone.trim()) && all.phone) {
      found.phone = all.phone;
    }
    if (Object.keys(found).length > 0) {
      setErrors((e) => ({ ...e, ...found }));
      return;
    }

    setTouched(true);
    creating.current = true;
    setSocialBusy(provider);
    const result = provider === 'google' ? await signInWithGoogle() : await signInWithApple();
    if (!result.ok) {
      creating.current = false;
      setSocialBusy(null);
      return;
    }

    // Le nom du fournisseur l'emporte ; à défaut, ce que la personne avait déjà tapé dans le formulaire.
    const profile = toProfile(draft);
    // En démonstration, la session vient d'être ouverte SANS numéro (Google et Apple n'en donnent
    // pas) : on l'y range tout de suite, sans réseau. En vrai, l'écran de suite l'associe.
    if (demoMode && isPhoneAuthEnabled && profile.phoneE164) await linkPhone(profile.phoneE164);
    // Avec un serveur, le numéro devient d'abord un CONTACT du compte (comme par e-mail) : si
    // l'association échoue maintenant, elle sera retentée à la connexion suivante.
    if (!demoMode && profile.phoneE164) await saveContactPhone(profile.phoneE164);
    onProfile?.({
      firstName: result.firstName || profile.firstName,
      lastName: result.lastName || profile.lastName,
      email: result.email || profile.email,
      phone: profile.phone,
      siret: pro ? (profile.siret ?? '') : '',
      location: profile.location,
      shopName: pro ? profile.shopName : '',
      category: pro ? (profile.category as Category | '') : '',
      address: pro ? profile.address : '',
      modes,
    });
    // Un numéro tapé dans le formulaire s'associe aussi, comme pour une inscription par e-mail.
    await continueAfterAccount(result.email, profile.phoneE164, false);
    creating.current = false;
    setSocialBusy(null);
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
      testID="signup-phone"
      icon="phone"
      prefix={
        <View className="flex-row items-center gap-1 self-stretch border-x border-line px-2.5">
          <AppText className="text-base">🇫🇷</AppText>
          <Feather name="chevron-down" size={11} color={colors.inkFaint} />
        </View>
      }
      value={draft.phone}
      onChangeText={(v) => set('phone', v)}
      error={errors.phone}
      placeholder={needsPhone(role) ? 'Téléphone' : 'Téléphone (facultatif)'}
      accessibilityLabel="Numéro de téléphone"
      keyboardType="phone-pad"
      textContentType="telephoneNumber"
    />
  );
  const location = (
    <Field
      key="location"
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

  if (verification) {
    return (
      <Screen testID="sign-up-verification">
        <BrandBar />
        <ScrollView
          contentContainerClassName="flex-grow pb-8 pt-6"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <SignUpVerification
            email={verification.email}
            phone={verification.phone}
            needsEmailCode={verification.needsEmailCode}
            phoneEnabled={isPhoneAuthEnabled && !demoMode}
            onDone={() => onSignedUp?.()}
            onBack={() => setVerification(null)}
          />
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen testID="sign-up-screen">
      <BrandBar
        {...(onBack ? { onBack } : {})}
        backTestID="signup-back"
        backLabel="Retour au choix du profil"
      />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerClassName="pb-8 pt-6"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <ScreenIntro
            title={pro ? proCopy.title : 'Créer mon compte'}
            subtitle={
              pro
                ? proCopy.subtitle
                : 'Inscris-toi pour accéder aux meilleures offres Flash autour de toi.'
            }
          >
            {pro ? (
              <View className="h-16 w-16 items-center justify-center rounded-pill border-2 border-brand-500 bg-brand-50">
                <Feather name="shopping-bag" size={26} color={colors.brand500} />
                <View className="absolute -bottom-1 -right-1 h-6 w-6 items-center justify-center rounded-pill border-2 border-surface bg-brand-500">
                  <Feather name="plus" size={12} color={colors.inkInverse} />
                </View>
              </View>
            ) : renderAvatar ? (
              renderAvatar()
            ) : null}
          </ScreenIntro>

          {pro ? (
            <View className="gap-8">
              <FormSection title="Vos coordonnées">
                {firstName}
                {lastName}
                {email}
                {phone}
              </FormSection>

              <FormSection title={role === 'grossiste' ? 'Votre entreprise' : 'Votre commerce'}>
                <Field
                  testID="signup-shopname"
                  icon="shopping-bag"
                  value={draft.shopName}
                  onChangeText={(v) => set('shopName', v)}
                  error={errors.shopName}
                  placeholder={role === 'grossiste' ? 'Nom de l’entreprise' : 'Nom du commerce'}
                  accessibilityLabel={
                    role === 'grossiste' ? 'Nom de l’entreprise' : 'Nom du commerce'
                  }
                  autoCapitalize="words"
                />
                <CategorySelect
                  value={draft.category}
                  error={errors.category}
                  onChange={(key) => set('category', key)}
                />
                <Field
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

                <View className="gap-1.5">
                  <View className="flex-row gap-3">
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
                            'h-12 flex-1 flex-row items-center justify-center gap-2 rounded-control border',
                            on ? 'border-brand-500 bg-brand-50' : 'border-line bg-surface-muted',
                          )}
                        >
                          <Feather
                            name={
                              on ? 'check-circle' : m === 'livraison' ? 'truck' : 'shopping-bag'
                            }
                            size={16}
                            color={on ? colors.brand600 : colors.inkMuted}
                          />
                          <AppText
                            className={cn(
                              'font-sans-semibold text-sm',
                              on ? 'text-brand-600' : 'text-ink-muted',
                            )}
                          >
                            {modeLabel[m]}
                          </AppText>
                        </Pressable>
                      );
                    })}
                  </View>
                  {errors.modes ? (
                    <AppText
                      testID="signup-modes-error"
                      variant="caption"
                      className="text-brand-600"
                    >
                      {errors.modes}
                    </AppText>
                  ) : null}
                </View>
              </FormSection>

              <FormSection title="Mot de passe">{passwords}</FormSection>
            </View>
          ) : (
            <View className="gap-3">
              {firstName}
              {lastName}
              {email}
              {phone}
              {passwords}
              {location}
            </View>
          )}

          <View className="mt-6 gap-1.5">
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
                J’accepte les <AppText className="text-sm text-brand-600">CGU</AppText> et la{' '}
                <AppText className="text-sm text-brand-600">politique de confidentialité</AppText>.
              </AppText>
            </Checkbox>
            {errors.terms ? (
              <AppText testID="signup-terms-error" variant="caption" className="text-brand-600">
                {errors.terms}
              </AppText>
            ) : null}
          </View>

          {serverError ? (
            <View className="mt-4 flex-row items-start gap-2 rounded-control border border-brand-200 bg-brand-50 p-3">
              <Feather name="alert-circle" size={15} color={colors.brand600} />
              <AppText testID="signup-error" variant="caption" className="flex-1 text-brand-600">
                {serverError}
              </AppText>
            </View>
          ) : null}

          <View className="mt-6 gap-3">
            <Button
              testID="signup-submit"
              label={pro ? proCopy.title : 'Créer mon compte'}
              loading={submitting}
              disabled={socialBusy !== null}
              onPress={submit}
            />
            {onSignIn ? (
              <Button
                testID="signup-to-signin"
                label="J’ai déjà un compte"
                variant="outline"
                onPress={onSignIn}
              />
            ) : null}
          </View>

          {role === 'commercant' ? (
            <View
              testID="signup-free-ops"
              className="mt-4 flex-row items-center gap-3 rounded-control border border-line bg-surface-muted p-3"
            >
              <View className="h-10 w-10 items-center justify-center rounded-pill bg-brand-50">
                <Feather name="gift" size={18} color={colors.brand500} />
              </View>
              <View className="flex-1">
                <AppText className="font-sans-bold text-sm text-ink">
                  {PLATFORM_SETTINGS.freeOperations} opérations Flash gratuites
                </AppText>
                <AppText variant="caption" className="text-xs">
                  {/* Espace insécable : « TK LINK » ne se coupe pas en fin de ligne. */}
                  {'Pour démarrer sur TK LINK.'}
                </AppText>
              </View>
            </View>
          ) : (
            <View testID="signup-alternatives" className="mt-8 gap-4">
              <View className="flex-row items-center gap-3">
                <View className="h-px flex-1 bg-line" />
                <AppText variant="caption" className="text-ink-muted">
                  Continuer autrement
                </AppText>
                <View className="h-px flex-1 bg-line" />
              </View>
              <View className="flex-row gap-3">
                {available.google ? (
                  <SocialButton
                    provider="google"
                    variant="icon"
                    loading={socialBusy === 'google'}
                    disabled={socialBusy !== null || submitting}
                    onPress={() => void social('google')}
                  />
                ) : null}
                {available.apple ? (
                  <SocialButton
                    provider="apple"
                    variant="icon"
                    loading={socialBusy === 'apple'}
                    disabled={socialBusy !== null || submitting}
                    onPress={() => void social('apple')}
                  />
                ) : null}
                {isPhoneAuthEnabled ? (
                  <AltButton
                    testID="signup-alt-smartphone"
                    icon="smartphone"
                    label="Se connecter avec un numéro de téléphone"
                    onPress={() => onSignIn?.()}
                  />
                ) : null}
              </View>
            </View>
          )}

          {/* La réassurance de la maquette : trois promesses que l'app tient. Chaque icône au-dessus
              de son texte, centrés : côte à côte, les trois libellés ne s'alignaient sur rien. */}
          <View className="mt-8 flex-row">
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
              <View key={label} className="flex-1 items-center gap-2">
                <View className="h-10 w-10 items-center justify-center rounded-pill border border-brand-200 bg-brand-50">
                  <Feather name={icon} size={17} color={colors.brand500} />
                </View>
                <AppText variant="caption" className="text-center text-xs leading-4">
                  {label}
                </AppText>
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/* ---------------------------------------------------------------- morceaux */

/** Un groupe du formulaire professionnel : un petit titre, puis ses champs. */
function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-3">
      <AppText className="font-sans-semibold text-xs uppercase tracking-wider text-ink-faint">
        {title}
      </AppText>
      {children}
    </View>
  );
}

type FieldProps = {
  testID: string;
  error?: string | undefined;
  hint?: string;
} & Omit<React.ComponentProps<typeof TextField>, 'testID' | 'className' | 'invalid'>;

function Field({ testID, error, hint, ...rest }: FieldProps) {
  return (
    <View className="gap-1.5">
      <View className="flex-row">
        <TextField testID={testID} invalid={!!error} {...rest} />
      </View>
      {error ? (
        <AppText testID={`${testID}-error`} variant="caption" className="text-brand-600">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" className="text-xs text-ink-faint">
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
          'h-12 flex-row items-center gap-2.5 rounded-control border bg-surface-muted px-3.5',
          error ? 'border-brand-500' : 'border-line',
        )}
      >
        <Feather name="tag" size={17} color={colors.brand500} />
        <AppText className={cn('flex-1 text-base', label ? 'text-ink' : 'text-ink-faint')}>
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
                className="flex-row items-center justify-between px-3.5 py-3"
              >
                <AppText
                  className={cn('text-sm', on ? 'font-sans-bold text-brand-500' : 'text-ink')}
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

/** Un carré d'icône de la rangée « Continuer autrement ». */
function AltButton({
  testID,
  icon,
  label,
  onPress,
}: {
  testID: string;
  icon: 'smartphone';
  label: string;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="h-12 flex-1 items-center justify-center rounded-control border border-line bg-surface-muted active:opacity-70"
    >
      <Feather name={icon} size={19} color={colors.brand500} />
    </Pressable>
  );
}

/** Lien « j'ai déjà un compte » — conservé pour les routes qui le composent seules. */
export function SignUpFooterLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable testID="signup-footer-signin" accessibilityRole="button" onPress={onPress}>
      <AppText variant="caption" className="text-center text-ink-muted">
        Vous avez déjà un compte ?{' '}
        <AppText className="font-sans-bold text-sm text-brand-600">Se connecter</AppText>
      </AppText>
    </Pressable>
  );
}
