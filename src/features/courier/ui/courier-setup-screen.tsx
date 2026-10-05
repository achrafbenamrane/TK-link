import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { Image } from 'expo-image';

import { cn } from '@/shared/lib/cn';
import { pickImage } from '@/shared/lib/image-picker';
import { AppText, Button, Screen, Wordmark } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

import { VEHICLES, VEHICLE_LABEL, type Vehicle } from '../lib/courier';
import { useCourierStore } from '../model/store';

type Props = {
  /** Build de démonstration : propose de simuler le contrôle de TK LINK. Absent en production. */
  demo?: boolean;
  /**
   * Demande la biométrie LOCALE de l'appareil. Fournie par la route : la
   * biométrie vit dans `shop`, que le livreur n'importe pas. Renvoie `true` si la
   * personne s'est authentifiée.
   */
  authenticate: (reason: string) => Promise<boolean>;
  /** « Accéder au tableau de bord » — la navigation reste à la route. */
  onDone: () => void;
};

type Step = 'infos' | 'verification' | 'securite' | 'valide';
const STEPS: Step[] = ['infos', 'verification', 'securite', 'valide'];
const STEP_TITLE: Record<Step, string> = {
  infos: 'Vos informations',
  verification: 'Vérification du profil',
  securite: 'Sécurisation du compte',
  valide: 'Compte validé',
};

/**
 * LE PARCOURS LIVREUR, étapes 3 à 6 du schéma du client :
 *
 *   3. Dépôt des informations (pièce d'identité, selfie, zone d'activité, véhicule)
 *   4. Vérification du profil — contrôle par TK LINK
 *   5. Sécurisation (appareil enregistré + biométrie locale)
 *   6. Compte validé
 *
 * La création du compte (étape 2) est l'inscription commune. Ici, rien n'est
 * validé par l'app : la vérification d'identité est l'affaire de TK LINK. Tant
 * qu'il n'y a pas de serveur, un bouton « démo » la simule — et le dit.
 */
export function CourierSetupScreen({ authenticate, onDone, demo = false }: Props) {
  const colors = useColors();
  // Des sélecteurs, pas le magasin entier : saisir un champ ne refait pas tout l'écran.
  const status = useCourierStore((s) => s.status);
  const savedVehicle = useCourierStore((s) => s.vehicle);
  const savedZone = useCourierStore((s) => s.zone);
  const savedIdUri = useCourierStore((s) => s.idUri);
  const savedSelfieUri = useCourierStore((s) => s.selfieUri);
  const deviceEnrolled = useCourierStore((s) => s.deviceEnrolled);
  const submitProfile = useCourierStore((s) => s.submitProfile);
  const validateAccount = useCourierStore((s) => s.validateAccount);
  const setDeviceEnrolled = useCourierStore((s) => s.setDeviceEnrolled);

  // On reprend là où le dossier en est : un livreur qui rouvre l'app ne
  // ressaisit pas ses justificatifs.
  const initial: Step =
    status === 'valide'
      ? // Compte validé mais appareil pas encore enrôlé : l'étape de sécurisation reste à faire.
        deviceEnrolled
        ? 'valide'
        : 'securite'
      : status === 'en_verification'
        ? 'verification'
        : 'infos';
  const [step, setStep] = useState<Step>(initial);

  const [vehicle, setVehicle] = useState<Vehicle | null>(savedVehicle);
  const [zone, setZone] = useState(savedZone);
  const [idUri, setIdUri] = useState(savedIdUri);
  const [selfieUri, setSelfieUri] = useState(savedSelfieUri);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [secureNote, setSecureNote] = useState<string | null>(null);

  const submit = () => {
    const res = submitProfile({ vehicle, zone, idUri, selfieUri });
    if (res.ok) {
      setErrors({});
      setStep('verification');
    } else {
      setErrors(res.errors);
    }
  };

  const enrol = async () => {
    const ok = await authenticate('Enregistrer cet appareil pour TK Deliver');
    if (ok) {
      setDeviceEnrolled(true);
      setSecureNote(null);
      setStep('valide');
    } else {
      setSecureNote('Authentification non effectuée. Vous pourrez la refaire depuis votre compte.');
    }
  };

  const index = STEPS.indexOf(step);

  const photo = (
    key: 'idUri' | 'selfieUri',
    uri: string,
    set: (u: string) => void,
    label: string,
    source: 'galerie' | 'camera',
  ) => (
    <View className="gap-1.5">
      <AppText variant="caption" className="font-sans-semibold text-ink-muted">
        {label}
      </AppText>
      {uri ? (
        <View testID={`courier-${key}-preview`} className="flex-row items-center gap-3">
          <Image
            source={{ uri }}
            style={{ width: 72, height: 72, borderRadius: 12 }}
            contentFit="cover"
          />
          <Pressable
            testID={`courier-${key}-remove`}
            accessibilityRole="button"
            accessibilityLabel={`Retirer : ${label}`}
            onPress={() => set('')}
          >
            <AppText className="font-sans-semibold text-brand-600" style={{ fontSize: 13 }}>
              Remplacer
            </AppText>
          </Pressable>
        </View>
      ) : (
        <Pressable
          testID={`courier-${key}-add`}
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={async () => {
            const picked = await pickImage(source, {
              aspect: key === 'selfieUri' ? [1, 1] : [4, 3],
              front: key === 'selfieUri',
            });
            if (picked) set(picked);
          }}
          className={cn(
            'flex-row items-center gap-3 rounded-control border border-dashed bg-brand-50 px-4 py-4',
            errors[key] ? 'border-danger' : 'border-brand-500',
          )}
        >
          <Feather
            name={source === 'camera' ? 'camera' : 'image'}
            size={18}
            color={colors.brand500}
          />
          <AppText className="font-sans-semibold text-brand-600" style={{ fontSize: 13.5 }}>
            {source === 'camera' ? 'Prendre la photo' : 'Choisir la photo'}
          </AppText>
        </Pressable>
      )}
      {errors[key] ? (
        <AppText variant="caption" className="text-danger">
          {errors[key]}
        </AppText>
      ) : null}
    </View>
  );

  return (
    <Screen testID="courier-setup-screen">
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
              Pièce d’identité, selfie, zone d’activité et véhicule : TK LINK contrôle votre dossier
              avant toute mission.
            </AppText>

            <View className="gap-1.5">
              <AppText variant="caption" className="font-sans-semibold text-ink-muted">
                Véhicule
              </AppText>
              <View className="flex-row gap-2">
                {VEHICLES.map((v) => {
                  const on = vehicle === v;
                  return (
                    <Pressable
                      key={v}
                      testID={`courier-vehicle-${v}`}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={VEHICLE_LABEL[v]}
                      onPress={() => setVehicle(v)}
                      className={cn(
                        'flex-1 items-center rounded-control border py-3',
                        on ? 'border-brand-500 bg-brand-50' : 'border-line bg-surface-muted',
                      )}
                    >
                      <AppText
                        className={cn(
                          'font-sans-semibold',
                          on ? 'text-brand-600' : 'text-ink-muted',
                        )}
                        style={{ fontSize: 13.5 }}
                      >
                        {VEHICLE_LABEL[v]}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
              {errors.vehicle ? (
                <AppText variant="caption" className="text-danger">
                  {errors.vehicle}
                </AppText>
              ) : null}
            </View>

            <View className="gap-1.5">
              <AppText variant="caption" className="font-sans-semibold text-ink-muted">
                Zone d’activité
              </AppText>
              <TextInput
                testID="courier-zone"
                value={zone}
                onChangeText={setZone}
                placeholder="Ex. Toulouse centre, Muret"
                placeholderTextColor={colors.inkFaint}
                accessibilityLabel="Zone d’activité"
                className={cn(
                  'rounded-control border bg-surface px-3.5 py-3 font-sans text-ink',
                  errors.zone ? 'border-danger' : 'border-line',
                )}
                style={{ fontSize: 15 }}
              />
              {errors.zone ? (
                <AppText variant="caption" className="text-danger">
                  {errors.zone}
                </AppText>
              ) : null}
            </View>

            {photo('idUri', idUri, setIdUri, 'Pièce d’identité', 'galerie')}
            {photo('selfieUri', selfieUri, setSelfieUri, 'Selfie', 'camera')}

            <Button testID="courier-submit" label="Envoyer mon dossier" onPress={submit} />
          </View>
        ) : null}

        {step === 'verification' ? (
          <View className="gap-4">
            <View className="items-center gap-3 rounded-card border border-line bg-surface p-6">
              <View className="h-16 w-16 items-center justify-center rounded-pill bg-brand-50">
                <Feather
                  name={status === 'valide' ? 'check' : 'shield'}
                  size={28}
                  color={colors.brand500}
                />
              </View>
              <AppText testID="courier-verification-status" className="text-center font-sans-bold">
                {status === 'valide'
                  ? 'Votre profil est vérifié'
                  : 'Votre dossier est en cours de contrôle'}
              </AppText>
              <AppText variant="caption" className="text-center">
                TK LINK vérifie votre identité avant d’ouvrir les missions. Vous serez prévenu dès
                que c’est fait.
              </AppText>
            </View>

            {status === 'valide' ? (
              <Button
                testID="courier-to-security"
                label="Continuer"
                onPress={() => setStep('securite')}
              />
            ) : demo ? (
              <Pressable
                testID="courier-demo-validate"
                accessibilityRole="button"
                onPress={() => validateAccount()}
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
                Appareil enregistré + biométrie locale
              </AppText>
              <AppText variant="caption" className="text-center">
                Votre empreinte reste sur ce téléphone : TK LINK n’en stocke jamais. Elle sert aussi
                aux opérations sensibles, comme la remise d’un colis important.
              </AppText>
            </View>
            {secureNote ? (
              <AppText testID="courier-secure-note" variant="caption" className="text-ink-faint">
                {secureNote}
              </AppText>
            ) : null}
            <Button testID="courier-enrol" label="Activer la biométrie" onPress={enrol} />
            <Button
              testID="courier-skip-secure"
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
              Votre compte livreur est validé
            </AppText>
            <AppText variant="caption" className="text-center">
              Passez en ligne depuis votre tableau de bord pour recevoir des missions.
            </AppText>
            <View className="w-full">
              <Button testID="courier-done" label="Accéder au tableau de bord" onPress={onDone} />
            </View>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
