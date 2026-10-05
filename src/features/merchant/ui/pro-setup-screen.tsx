import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { pickImage } from '@/shared/lib/image-picker';
import { formatSiret } from '@/shared/lib/roles';
import { AppText, Button, Screen, Wordmark } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

import { PRO_COPY, type ProRole } from '../lib/supplier';
import { selectSupplier, useMerchantStore } from '../model/store';

type Props = {
  /** Build de démonstration : propose de simuler le contrôle de TK LINK. Absent en production. */
  demo?: boolean;
  /** Le profil qui dépose son dossier : change les mots, pas les étapes. */
  role?: ProRole;
  /** Le SIRET et l'adresse saisis à l'inscription : on ne les redemande pas. */
  siret: string;
  address: string;
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
  initialIban = '',
  authenticate,
  onDone,
  demo = false,
}: Props) {
  const colors = useColors();
  const supplier = useMerchantStore(selectSupplier);
  const submit = useMerchantStore((s) => s.submitSupplier);
  const validate = useMerchantStore((s) => s.validateSupplier);
  const setDevice = useMerchantStore((s) => s.setSupplierDevice);

  // On reprend là où le dossier en est : on ne ressaisit pas ses pièces.
  const [step, setStep] = useState<Step>(
    supplier.status === 'valide'
      ? supplier.deviceEnrolled
        ? 'valide'
        : 'securite'
      : supplier.status === 'en_verification'
        ? 'verification'
        : 'infos',
  );
  const [addr, setAddr] = useState(address);
  const [iban, setIban] = useState(initialIban);
  const [idUri, setIdUri] = useState(supplier.idUri);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [secureNote, setSecureNote] = useState<string | null>(null);

  const index = STEPS.indexOf(step);

  const send = () => {
    const res = submit({ siret, address: addr, iban, idUri });
    if (res.ok) {
      setErrors({});
      setStep('verification');
    } else {
      setErrors(res.errors);
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
              <View
                testID="supplier-siret"
                className={cn(
                  'flex-row items-center justify-between rounded-control border bg-surface-muted px-3.5 py-3',
                  errors.siret ? 'border-danger' : 'border-line',
                )}
              >
                <AppText className="text-ink" style={{ fontSize: 15 }}>
                  {siret ? formatSiret(siret) : 'Non renseigné'}
                </AppText>
                <Feather name="lock" size={14} color={colors.inkFaint} />
              </View>
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

            <Button testID="supplier-submit" label="Envoyer mon dossier" onPress={send} />
          </View>
        ) : null}

        {step === 'verification' ? (
          <View className="gap-4">
            <View className="items-center gap-3 rounded-card border border-line bg-surface p-6">
              <View className="h-16 w-16 items-center justify-center rounded-pill bg-brand-50">
                <Feather
                  name={supplier.status === 'valide' ? 'check' : 'shield'}
                  size={28}
                  color={colors.brand500}
                />
              </View>
              <AppText testID="supplier-verification-status" className="text-center font-sans-bold">
                {supplier.status === 'valide'
                  ? `Votre ${PRO_COPY[role].entity} est vérifié${role === 'grossiste' ? 'e' : ''}`
                  : 'Votre dossier est en cours de contrôle'}
              </AppText>
              <AppText variant="caption" className="text-center">
                TK LINK contrôle les informations de votre {PRO_COPY[role].entity} avant d’ouvrir la
                publication d’offres. Vous serez prévenu dès que c’est fait.
              </AppText>
            </View>

            {supplier.status === 'valide' ? (
              <Button
                testID="supplier-to-security"
                label="Continuer"
                onPress={() => setStep('securite')}
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
            ) : null}
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
