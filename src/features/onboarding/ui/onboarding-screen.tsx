import { Feather } from '@expo/vector-icons';
import { useState, type ComponentProps } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cn } from '@/shared/lib/cn';
import { type Role } from '@/shared/lib/roles';
import { AppText, Button } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

import { INTERESTS } from '../lib/avatar';
import { selectFirstName, selectInterests, selectRole, useOnboardingStore } from '../model/store';

/** Où l'on va une fois l'accueil des nouveaux terminé : dans l'app. */
export type OnboardingExit = 'app';

type Props = {
  /**
   * Fin du parcours. La destination est décidée ICI mais TRADUITE par la
   * route : la feature ne connaît aucune URL.
   */
  onDone: (next: OnboardingExit) => void;
  /**
   * Demande l'autorisation de localisation. Fournie par la route : la boutique
   * sait la demander, `onboarding` n'importe pas `shop`.
   */
  onRequestLocation?: () => Promise<unknown> | void;
  /** Active la biométrie de l'appareil — fournie par la route, pour la même raison. */
  onEnableBiometrics?: () => Promise<unknown> | void;
};

type Step = 'interets' | 'localisation' | 'securite' | 'valide';

/**
 * Le parcours d'après le compte — étapes 3 à 6 du parcours que le client a
 * dessiné pour chaque rôle :
 *
 *   3. Choix des centres d'intérêt   4. Activation de la localisation
 *   5. Sécurisation du compte        6. Compte validé
 *
 * La création du compte vient AVANT (écran d'inscription, étape 2). Ici on ne
 * demande plus ni rôle, ni avatar, ni nom d'utilisateur, ni « particulier ou
 * professionnel » : le CDC ne les décrit pas, et l'inscription a déjà donné le
 * prénom. Chaque écran se passe d'un geste — rien ne bloque l'entrée dans l'app.
 */
const STEPS: Step[] = ['interets', 'localisation', 'securite', 'valide'];

/** Ce que l'étape « intérêts » veut dire selon le rôle. */
const INTEREST_COPY: Record<Role, { title: string; subtitle: string; label: string }> = {
  consommateur: {
    title: 'Vos centres d’intérêt',
    subtitle:
      'Les offres de ces catégories passent devant. Les autres restent visibles : rien n’est jamais caché.',
    label: 'Choisissez une, plusieurs ou toutes les catégories',
  },
  commercant: {
    title: 'Votre activité',
    subtitle: 'Vos rayons — pour vous montrer les bons lots.',
    label: 'Ce que vous vendez',
  },
  grossiste: {
    title: 'Votre activité',
    subtitle: 'Vos rayons — pour cibler les bons commerçants.',
    label: 'Ce que vous distribuez',
  },
};

export function OnboardingScreen({ onDone, onRequestLocation, onEnableBiometrics }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const firstName = useOnboardingStore(selectFirstName);
  const interests = useOnboardingStore(selectInterests);
  const role = useOnboardingStore(selectRole);
  const toggle = useOnboardingStore((s) => s.toggleInterest);
  const setInterests = useOnboardingStore((s) => s.setInterests);
  const complete = useOnboardingStore((s) => s.complete);

  const [step, setStep] = useState<Step>('interets');
  const [busy, setBusy] = useState(false);
  const index = STEPS.indexOf(step);
  const copy = INTEREST_COPY[role];
  const allSelected = interests.length === INTERESTS.length;

  const next = () => {
    if (step === 'valide') {
      complete();
      onDone('app');
      return;
    }
    setStep(STEPS[index + 1]!);
  };

  /** Lance une demande d'autorisation, puis avance — qu'elle soit accordée ou non. */
  const askThenNext = async (ask?: Props['onRequestLocation']) => {
    setBusy(true);
    try {
      await ask?.();
    } finally {
      setBusy(false);
      next();
    }
  };

  return (
    <View
      testID="onboarding-screen"
      className="flex-1 bg-surface"
      style={{ paddingTop: insets.top }}
    >
      {/* Progression */}
      <View className="flex-row gap-1.5 px-5 pb-1 pt-3">
        {STEPS.map((s, i) => (
          <View
            key={s}
            className={cn('h-1 flex-1 rounded-pill', i <= index ? 'bg-brand-500' : 'bg-line')}
          />
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="flex-grow px-5 pb-6 pt-6"
        keyboardShouldPersistTaps="handled"
      >
        {/* 3 — CDC §2.3 : les huit catégories, à choisir librement. */}
        {step === 'interets' ? (
          <View className="gap-5">
            <Header title={copy.title} subtitle={copy.subtitle} />

            <View className="gap-3">
              <View className="flex-row items-center justify-between">
                <AppText variant="caption" className="flex-1 text-ink-muted">
                  {copy.label}
                </AppText>
                <Pressable
                  testID="interest-all"
                  accessibilityRole="button"
                  accessibilityLabel={allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
                  onPress={() => setInterests(allSelected ? [] : INTERESTS.map((i) => i.key))}
                  hitSlop={8}
                >
                  <AppText className="font-sans-bold text-brand-600" style={{ fontSize: 13 }}>
                    {allSelected ? 'Tout retirer' : 'Tout choisir'}
                  </AppText>
                </Pressable>
              </View>

              <View className="flex-row flex-wrap gap-2">
                {INTERESTS.map((it) => {
                  const on = interests.includes(it.key);
                  return (
                    <Pressable
                      key={it.key}
                      testID={`interest-${it.key}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={it.label}
                      onPress={() => toggle(it.key)}
                      className={cn(
                        'flex-row items-center gap-2 rounded-pill border px-4 py-2.5',
                        on ? 'border-brand-500 bg-brand-500' : 'border-line bg-surface-muted',
                      )}
                    >
                      <Feather
                        name={it.icon as 'heart'}
                        size={15}
                        color={on ? colors.inkInverse : colors.brand500}
                      />
                      <AppText
                        className={cn(
                          'font-sans-semibold',
                          on ? 'text-ink-inverse' : 'text-ink-muted',
                        )}
                        style={{ fontSize: 13 }}
                      >
                        {it.label}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>

              <AppText variant="caption" className="text-ink-faint" style={{ fontSize: 12 }}>
                Modifiable à tout moment.
              </AppText>
            </View>
          </View>
        ) : null}

        {/* 4 — la localisation, au service des offres proches. */}
        {step === 'localisation' ? (
          <Illustrated
            icon="map-pin"
            title="Activez la localisation"
            text="Une bonne affaire n’a de valeur que si vous pouvez l’atteindre à temps. Votre position sert à vous montrer les offres proches et pertinentes — rien d’autre."
            note="Vous pouvez refuser : vous choisirez alors une ville."
          />
        ) : null}

        {/* 5 — la sécurisation : appareil enregistré + authentification locale. */}
        {step === 'securite' ? (
          <Illustrated
            icon="shield"
            title="Sécurisez votre compte"
            text="Votre appareil est enregistré. Vous pouvez y ajouter l’empreinte ou le visage : elle protège aussi les paiements et les données sensibles."
            note="L’empreinte reste sur votre téléphone : TK LINK ne la stocke jamais."
          />
        ) : null}

        {/* 6 — compte validé. */}
        {step === 'valide' ? (
          <Illustrated
            icon="check-circle"
            tone="success"
            title={firstName ? `C’est prêt, ${firstName}` : 'C’est prêt'}
            text="Votre compte est validé. Les meilleures affaires autour de vous vous attendent."
          />
        ) : null}
      </ScrollView>

      {/* Barre d'action */}
      <View className="gap-1 px-5 pt-2" style={{ paddingBottom: insets.bottom + 12 }}>
        {step === 'localisation' ? (
          <>
            <Button
              testID="onboarding-location"
              label="Activer la localisation"
              loading={busy}
              onPress={() => askThenNext(onRequestLocation)}
            />
            <SoftLink testID="onboarding-skip" label="Plus tard" onPress={next} />
          </>
        ) : step === 'securite' ? (
          <>
            <Button
              testID="onboarding-secure"
              label="Activer l’empreinte ou le visage"
              loading={busy}
              onPress={() => askThenNext(onEnableBiometrics)}
            />
            <SoftLink testID="onboarding-skip" label="Plus tard" onPress={next} />
          </>
        ) : (
          <Button
            testID="onboarding-next"
            label={step === 'valide' ? 'Découvrir les offres' : 'Continuer'}
            onPress={next}
          />
        )}

        {index > 0 && step !== 'valide' ? (
          <SoftLink
            testID="onboarding-back"
            label="Retour"
            onPress={() => setStep(STEPS[index - 1]!)}
          />
        ) : null}
      </View>
    </View>
  );
}

/* ---------------------------------------------------------------- morceaux */

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View className="gap-1.5">
      <AppText variant="display" style={{ fontSize: 28 }}>
        {title}
      </AppText>
      <AppText variant="caption">{subtitle}</AppText>
    </View>
  );
}

function Illustrated({
  icon,
  title,
  text,
  note,
  tone = 'brand',
}: {
  icon: ComponentProps<typeof Feather>['name'];
  title: string;
  text: string;
  note?: string;
  tone?: 'brand' | 'success';
}) {
  const colors = useColors();
  const color = tone === 'success' ? colors.success : colors.brand500;
  return (
    <View className="flex-1 items-center justify-center gap-5 px-2">
      <View
        className="h-32 w-32 items-center justify-center rounded-pill border-2"
        style={{ borderColor: color }}
      >
        <Feather name={icon} size={52} color={color} />
      </View>
      <View className="items-center gap-2">
        <AppText variant="display" className="text-center" style={{ fontSize: 26 }}>
          {title}
        </AppText>
        <AppText variant="caption" className="text-center" style={{ fontSize: 14 }}>
          {text}
        </AppText>
      </View>
      {note ? (
        <View className="flex-row items-start gap-2 rounded-card bg-surface-muted p-3.5">
          <Feather name="info" size={14} color={colors.inkFaint} />
          <AppText variant="caption" className="flex-1 text-ink-muted" style={{ fontSize: 12 }}>
            {note}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

function SoftLink({
  testID,
  label,
  onPress,
}: {
  testID: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="items-center py-2.5"
    >
      <AppText variant="caption" className="text-ink-muted">
        {label}
      </AppText>
    </Pressable>
  );
}
