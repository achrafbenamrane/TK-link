import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { pickImage } from '@/shared/lib/image-picker';
import { formatSiret } from '@/shared/lib/roles';
import { AppText, Button, Screen, Wordmark } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

import type { ShopApiError } from '../lib/shop-api';
import { PRO_COPY, type ProRole, type SupplierStatus } from '../lib/supplier';
import { selectSupplier, useMerchantStore, type ShopDetails } from '../model/store';

type Props = {
  /** Build de démonstration : propose de simuler le contrôle de TK LINK. Absent en production. */
  demo?: boolean;
  /** Le profil qui dépose son dossier : change les mots, pas les étapes. */
  role?: ProRole;
  /**
   * Le SIRET et l'adresse saisis à l'inscription : on ne les redemande pas. Sans SIRET (nouvel
   * appareil, ou après une déconnexion qui a remis le profil local à zéro), le champ se saisit ici.
   */
  siret: string;
  address: string;
  /**
   * Le commerce tel que l'inscription l'a décrit (nom, catégorie, quartier, modes de remise) : il part
   * au serveur avec le dossier. Le type de compte vient de `role`.
   */
  shop?: Omit<ShopDetails, 'kind'>;
  /** IBAN proposé d'avance (démonstration) ; vide en production. */
  initialIban?: string;
  /**
   * Demande l'authentification LOCALE de l'appareil. Fournie par la route : la biométrie
   * vit dans `shop`, que `merchant` n'importe pas. Renvoie `true` si la personne s'est
   * authentifiée.
   */
  authenticate: (reason: string) => Promise<boolean>;
  /** « Accéder au tableau de bord » — la navigation reste à la route. */
  onDone: () => void;
};

type Step = 'infos' | 'verification' | 'securite' | 'valide';

const NO_SHOP: Omit<ShopDetails, 'kind'> = {
  name: '',
  category: 'restauration',
  area: '',
  modes: [],
};

/**
 * Après une relecture du statut sur le serveur : un dossier que l'appareil croyait à déposer peut
 * déjà être en vérification, validé ou refusé (nouveau téléphone) — et l'inverse. Les autres étapes
 * ne bougent pas : la personne y est en train de faire quelque chose.
 */
export function stepAfterSync(current: Step, status: SupplierStatus): Step {
  if (current === 'infos' && status !== 'brouillon') return 'verification';
  if (current === 'verification' && status === 'brouillon') return 'infos';
  return current;
}

/** Ce que l'écran dit quand le serveur refuse le dépôt. */
function filingMessage(code: ShopApiError | 'incomplete', role: ProRole): Record<string, string> {
  switch (code) {
    case 'siret_taken':
      return { siret: 'Ce SIRET est déjà enregistré par un autre compte TK LINK.' };
    case 'invalid':
      return { form: 'TK LINK a refusé ces informations : vérifiez le SIRET et l’adresse.' };
    case 'forbidden':
      return {
        form: `Ce compte n’est pas déclaré comme ${PRO_COPY[role].account}. Contactez TK LINK.`,
      };
    case 'incomplete':
      return {
        form: `Le nom ou la catégorie de votre ${PRO_COPY[role].entity} manque sur ce téléphone. Contactez TK LINK.`,
      };
    case 'not_signed_in':
      return { form: 'Votre session a expiré : reconnectez-vous, puis renvoyez le dossier.' };
    case 'network':
      return { form: 'Pas de connexion : le dossier n’est pas parti. Réessayez dans un instant.' };
    default:
      return { form: 'Le dossier n’a pas pu partir. Réessayez dans un instant.' };
  }
}
const STEPS: Step[] = ['infos', 'verification', 'securite', 'valide'];
const STEP_TITLE: Record<Step, string> = {
  infos: 'Informations professionnelles',
  verification: 'Vérification du profil',
  securite: 'Sécurisation du compte',
  valide: 'Compte validé',
};

/**
 * LE PARCOURS FOURNISSEUR, étapes 3 à 6 du « Process grossiste / fournisseur » du client :
 *
 *   3. Dépôt des informations pro (SIRET, identité, adresse, coordonnées bancaires)
 *   4. Vérification du profil — contrôle par TK LINK
 *   5. Sécurisation (appareil enregistré + authentification locale)
 *   6. Compte validé → tableau de bord fournisseur
 *
 * La création du compte (étape 2) est l'inscription commune. Rien n'est validé par l'app :
 * le contrôle de l'entreprise est l'affaire de TK LINK. Faute de serveur, un bouton
 * « démo » le simule — et le dit.
 */
export function ProSetupScreen({
  role = 'grossiste',
  siret,
  address,
  shop = NO_SHOP,
  initialIban = '',
  authenticate,
  onDone,
  demo = false,
}: Props) {
  const colors = useColors();
  const supplier = useMerchantStore(selectSupplier);
  const fileShop = useMerchantStore((s) => s.fileShop);
  const refreshShop = useMerchantStore((s) => s.refreshShop);
  const validate = useMerchantStore((s) => s.validateSupplier);
  const setDevice = useMerchantStore((s) => s.setSupplierDevice);

  // On reprend là où le dossier en est : on ne ressaisit pas ses pièces.
  const [step, setStep] = useState<Step>(
    supplier.status === 'valide'
      ? supplier.deviceEnrolled
        ? 'valide'
        : 'securite'
      : supplier.status === 'en_verification' || supplier.status === 'refuse'
        ? 'verification'
        : 'infos',
  );
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [addr, setAddr] = useState(address);
  // Connu à l'inscription : affiché, verrouillé. Inconnu sur cet appareil : à saisir, sinon le dossier
  // ne pourrait jamais partir.
  const siretLocked = siret !== '';
  const [siretValue, setSiretValue] = useState(siret);
  const [iban, setIban] = useState(initialIban);
  const [idUri, setIdUri] = useState(supplier.idUri);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [secureNote, setSecureNote] = useState<string | null>(null);

  const index = STEPS.indexOf(step);

  // Le serveur fait foi : à l'ouverture, on relit où en est le dossier (validé, refusé…).
  useEffect(() => {
    let alive = true;
    void refreshShop().then(() => {
      if (alive) setStep((s) => stepAfterSync(s, useMerchantStore.getState().supplier.status));
    });
    return () => {
      alive = false;
    };
  }, [refreshShop]);

  const check = async () => {
    setChecking(true);
    await refreshShop();
    setChecking(false);
    setStep((s) => stepAfterSync(s, useMerchantStore.getState().supplier.status));
  };

  const send = async () => {
    if (sending) return;
    setSending(true);
    const res = await fileShop(
      { siret: siretValue.replace(/\s/g, ''), address: addr, iban, idUri },
      { ...shop, kind: role },
    );
    setSending(false);
    if (res.ok) {
      setErrors({});
      setStep('verification');
    } else {
      setErrors('errors' in res ? res.errors : filingMessage(res.code, role));
    }
  };

  const enrol = async () => {
    const ok = await authenticate('Enregistrer cet appareil pour TK LINK Pro');
    if (ok) {
      setDevice(true);
      setSecureNote(null);
      setStep('valide');
    } else {
      setSecureNote('Authentification non effectuée. Vous pourrez la refaire depuis votre compte.');
    }
  };

  const field = (
    key: 'address' | 'iban',
    label: string,
    value: string,
    set: (v: string) => void,
    placeholder: string,
  ) => (
    <View className="gap-1.5">
      <AppText variant="caption" className="font-sans-semibold text-ink-muted">
        {label}
      </AppText>
      <TextInput
        testID={`supplier-${key}`}
        value={value}
        onChangeText={set}
        placeholder={placeholder}
        placeholderTextColor={colors.inkFaint}
        autoCapitalize={key === 'iban' ? 'characters' : 'sentences'}
        accessibilityLabel={label}
        className={cn(
          'rounded-control border bg-surface px-3.5 py-3 font-sans text-ink',
          errors[key] ? 'border-danger' : 'border-line',
        )}
        style={{ fontSize: 15 }}
      />
      {errors[key] ? (
        <AppText variant="caption" className="text-danger">
          {errors[key]}
        </AppText>
      ) : null}
    </View>
  );

  return (
    <Screen testID="pro-setup-screen">
      <ScrollView
        contentContainerClassName="gap-4 pb-8 pt-3"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-row items-center justify-between">
          <Wordmark size={22} />
          <AppText variant="caption" className="text-ink-faint">
            Étape {index + 1} sur {STEPS.length}
          </AppText>
        </View>

        <View className="flex-row gap-1.5">
          {STEPS.map((s, i) => (
            <View
              key={s}
              className={cn('h-1 flex-1 rounded-pill', i <= index ? 'bg-brand-500' : 'bg-line')}
            />
          ))}
        </View>

        <AppText variant="display" style={{ fontSize: 24 }}>
          {STEP_TITLE[step]}
        </AppText>

        {step === 'infos' ? (
          <View className="gap-4">
            <AppText variant="caption">
              SIRET, identité, adresse et coordonnées bancaires : TK LINK contrôle votre{' '}
              {PRO_COPY[role].entity}
              avant l’ouverture du {PRO_COPY[role].dashboard}.
            </AppText>

            <View className="gap-1.5">
              <AppText variant="caption" className="font-sans-semibold text-ink-muted">
                SIRET
              </AppText>
              {siretLocked ? (
                <View
                  testID="supplier-siret"
                  className={cn(
                    'flex-row items-center justify-between rounded-control border bg-surface-muted px-3.5 py-3',
                    errors.siret ? 'border-danger' : 'border-line',
                  )}
                >
                  <AppText className="text-ink" style={{ fontSize: 15 }}>
                    {formatSiret(siret)}
                  </AppText>
                  <Feather name="lock" size={14} color={colors.inkFaint} />
                </View>
              ) : (
                <TextInput
                  testID="supplier-siret-input"
                  value={siretValue}
                  onChangeText={setSiretValue}
                  placeholder="14 chiffres"
                  placeholderTextColor={colors.inkFaint}
                  keyboardType="number-pad"
                  maxLength={17}
                  accessibilityLabel="SIRET"
                  className={cn(
                    'rounded-control border bg-surface px-3.5 py-3 font-sans text-ink',
                    errors.siret ? 'border-danger' : 'border-line',
                  )}
                />
              )}
              {errors.siret ? (
                <AppText variant="caption" className="text-danger">
                  {errors.siret}
                </AppText>
              ) : null}
            </View>

            {field(
              'address',
              `Adresse ${role === 'grossiste' ? 'de l’entreprise' : 'du commerce'}`,
              addr,
              setAddr,
              '8 rue des Carmes, 31000',
            )}
            {field('iban', 'IBAN (coordonnées bancaires)', iban, setIban, 'FR76 …')}

            <View className="gap-1.5">
              <AppText variant="caption" className="font-sans-semibold text-ink-muted">
                Pièce d’identité du dirigeant
              </AppText>
              {idUri ? (
                <View testID="supplier-id-preview" className="flex-row items-center gap-3">
                  <Image
                    source={{ uri: idUri }}
                    style={{ width: 72, height: 72, borderRadius: 12 }}
                    contentFit="cover"
                  />
                  <Pressable
                    testID="supplier-id-remove"
                    accessibilityRole="button"
                    accessibilityLabel="Remplacer la pièce d’identité"
                    onPress={() => setIdUri('')}
                  >
                    <AppText className="font-sans-semibold text-brand-600" style={{ fontSize: 13 }}>
                      Remplacer
                    </AppText>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  testID="supplier-id-add"
                  accessibilityRole="button"
                  accessibilityLabel="Ajouter la pièce d’identité"
                  onPress={async () => {
                    const picked = await pickImage('galerie', { aspect: [4, 3] });
                    if (picked) setIdUri(picked);
                  }}
                  className={cn(
                    'flex-row items-center gap-3 rounded-control border border-dashed bg-brand-50 px-4 py-4',
                    errors.idUri ? 'border-danger' : 'border-brand-500',
                  )}
                >
                  <Feather name="image" size={18} color={colors.brand500} />
                  <AppText className="font-sans-semibold text-brand-600" style={{ fontSize: 13.5 }}>
                    Choisir la photo
                  </AppText>
                </Pressable>
              )}
              {errors.idUri ? (
                <AppText variant="caption" className="text-danger">
                  {errors.idUri}
                </AppText>
              ) : null}
            </View>

            {errors.form ? (
              <AppText testID="supplier-form-error" variant="caption" className="text-danger">
                {errors.form}
              </AppText>
            ) : null}
            <Button
              testID="supplier-submit"
              label="Envoyer mon dossier"
              loading={sending}
              onPress={() => void send()}
            />
          </View>
        ) : null}

        {step === 'verification' ? (
          <View className="gap-4">
            <View className="items-center gap-3 rounded-card border border-line bg-surface p-6">
              <View className="h-16 w-16 items-center justify-center rounded-pill bg-brand-50">
                <Feather
                  name={
                    supplier.status === 'valide'
                      ? 'check'
                      : supplier.status === 'refuse'
                        ? 'alert-circle'
                        : 'shield'
                  }
                  size={28}
                  color={colors.brand500}
                />
              </View>
              <AppText testID="supplier-verification-status" className="text-center font-sans-bold">
                {supplier.status === 'valide'
                  ? `Votre ${PRO_COPY[role].entity} est vérifié${role === 'grossiste' ? 'e' : ''}`
                  : supplier.status === 'refuse'
                    ? 'Votre dossier n’a pas été accepté'
                    : 'Votre dossier est en cours de contrôle'}
              </AppText>
              {supplier.status === 'refuse' ? (
                <AppText testID="supplier-review-note" variant="caption" className="text-center">
                  {supplier.reviewNote ||
                    'TK LINK n’a pas pu vérifier ces informations. Corrigez-les et renvoyez le dossier.'}
                </AppText>
              ) : (
                <AppText variant="caption" className="text-center">
                  TK LINK contrôle les informations de votre {PRO_COPY[role].entity} avant d’ouvrir
                  la publication d’offres. Vous serez prévenu dès que c’est fait.
                </AppText>
              )}
            </View>

            {supplier.status === 'valide' ? (
              <Button
                testID="supplier-to-security"
                label="Continuer"
                onPress={() => setStep('securite')}
              />
            ) : supplier.status === 'refuse' ? (
              <Button
                testID="supplier-fix"
                label="Corriger mon dossier"
                onPress={() => setStep('infos')}
              />
            ) : demo ? (
              <Pressable
                testID="supplier-demo-validate"
                accessibilityRole="button"
                onPress={() => validate()}
                className="items-center rounded-control border border-dashed border-line py-3.5"
              >
                <AppText className="font-sans-semibold text-ink-muted" style={{ fontSize: 13 }}>
                  Démo — simuler la validation par TK LINK
                </AppText>
              </Pressable>
            ) : (
              <View className="gap-2">
                <Button
                  testID="supplier-check"
                  label="Vérifier l’avancement"
                  variant="ghost"
                  loading={checking}
                  onPress={() => void check()}
                />
                {/* La vérification prend du temps : on entre dans l'app en attendant, la publication
                    reste fermée (onglet Flash) jusqu'à la validation. */}
                <Button
                  testID="supplier-wait-in-app"
                  label="Découvrir l’app en attendant"
                  onPress={onDone}
                />
              </View>
            )}
          </View>
        ) : null}

        {step === 'securite' ? (
          <View className="gap-4">
            <View className="items-center gap-3 rounded-card border border-line bg-surface p-6">
              <Feather name="lock" size={30} color={colors.brand500} />
              <AppText className="text-center font-sans-bold">
                Appareil enregistré + authentification sécurisée
              </AppText>
              <AppText variant="caption" className="text-center">
                Votre empreinte reste sur ce téléphone : TK LINK n’en stocke jamais. Elle protège
                aussi les opérations sensibles, comme la confirmation d’une commande de valeur.
              </AppText>
            </View>
            {secureNote ? (
              <AppText testID="supplier-secure-note" variant="caption" className="text-ink-faint">
                {secureNote}
              </AppText>
            ) : null}
            <Button testID="supplier-enrol" label="Activer l’authentification" onPress={enrol} />
            <Button
              testID="supplier-skip-secure"
              label="Plus tard"
              variant="ghost"
              onPress={() => setStep('valide')}
            />
          </View>
        ) : null}

        {step === 'valide' ? (
          <View className="items-center gap-4 pt-4">
            <View className="h-24 w-24 items-center justify-center rounded-pill border-2 border-brand-500">
              <Feather name="check" size={44} color={colors.brand500} />
            </View>
            <AppText className="text-center font-sans-bold" style={{ fontSize: 18 }}>
              Votre compte {PRO_COPY[role].account} est validé
            </AppText>
            <AppText variant="caption" className="text-center">
              {role === 'commercant'
                ? 'Accédez à votre tableau de bord pour paramétrer votre boutique et publier votre premier Flash.'
                : 'Accédez à votre tableau de bord pour paramétrer votre catalogue et publier votre première offre pro.'}
            </AppText>
            <View className="w-full">
              <Button testID="supplier-done" label="Accéder au tableau de bord" onPress={onDone} />
            </View>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
