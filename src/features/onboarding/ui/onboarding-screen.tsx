import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cn } from '@/shared/lib/cn';
import { AppText } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import {
  ACCESSORY_LABELS,
  AVATAR_LIMITS,
  canFinish,
  cycle,
  FACE_LABELS,
  INTERESTS,
  randomAvatar,
} from '../lib/avatar';
import { selectAvatar, selectFirstName, selectInterests, useOnboardingStore } from '../model/store';
import { AvatarView } from './avatar-view';

type Props = { onDone: () => void };

/** Les étapes, dans l'ordre. L'accroche écologique ouvre — c'est la promesse. */
const STEPS = ['impact', 'avatar', 'profil', 'interets'] as const;
type Step = (typeof STEPS)[number];

export function OnboardingScreen({ onDone }: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('impact');

  const firstName = useOnboardingStore(selectFirstName);
  const avatar = useOnboardingStore(selectAvatar);
  const interests = useOnboardingStore(selectInterests);
  const holderType = useOnboardingStore((s) => s.holderType);
  const medium = useOnboardingStore((s) => s.medium);

  const setFirstName = useOnboardingStore((s) => s.setFirstName);
  const setAvatar = useOnboardingStore((s) => s.setAvatar);
  const setHolderType = useOnboardingStore((s) => s.setHolderType);
  const setMedium = useOnboardingStore((s) => s.setMedium);
  const toggle = useOnboardingStore((s) => s.toggleInterest);
  const complete = useOnboardingStore((s) => s.complete);

  const index = STEPS.indexOf(step);
  const isLast = index === STEPS.length - 1;
  const canContinue = isLast ? canFinish(firstName, interests) : true;

  const next = () => {
    if (isLast) {
      complete();
      onDone();
      return;
    }
    setStep(STEPS[index + 1]!);
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
        contentContainerClassName="px-5 pb-6 pt-4"
        keyboardShouldPersistTaps="handled"
      >
        {step === 'impact' ? <ImpactStep /> : null}

        {step === 'avatar' ? (
          <View className="gap-5">
            <Header
              title="Votre avatar"
              subtitle="Il vous suivra sur votre carte et dans les jeux."
            />
            <View className="items-center gap-4">
              <View className="rounded-pill bg-surface-muted p-4">
                <AvatarView avatar={avatar} size={128} />
              </View>
              <Pressable
                testID="avatar-random"
                accessibilityRole="button"
                accessibilityLabel="Avatar au hasard"
                onPress={() => setAvatar(randomAvatar())}
                className="flex-row items-center gap-2 rounded-pill bg-surface-muted px-4 py-2"
              >
                <Feather name="shuffle" size={15} color={colors.ink} />
                <AppText className="font-sans-semibold text-ink" style={{ fontSize: 13 }}>
                  Surprenez-moi
                </AppText>
              </Pressable>
            </View>

            <View className="gap-3">
              <Picker
                testID="avatar-hue"
                label="Couleur"
                value={`${avatar.hue + 1} / ${AVATAR_LIMITS.hue}`}
                onPrev={() =>
                  setAvatar({ ...avatar, hue: cycle(avatar.hue, -1, AVATAR_LIMITS.hue) })
                }
                onNext={() =>
                  setAvatar({ ...avatar, hue: cycle(avatar.hue, 1, AVATAR_LIMITS.hue) })
                }
              />
              <Picker
                testID="avatar-face"
                label="Expression"
                value={FACE_LABELS[avatar.face] ?? ''}
                onPrev={() =>
                  setAvatar({ ...avatar, face: cycle(avatar.face, -1, AVATAR_LIMITS.face) })
                }
                onNext={() =>
                  setAvatar({ ...avatar, face: cycle(avatar.face, 1, AVATAR_LIMITS.face) })
                }
              />
              <Picker
                testID="avatar-accessory"
                label="Accessoire"
                value={ACCESSORY_LABELS[avatar.accessory] ?? ''}
                onPrev={() =>
                  setAvatar({
                    ...avatar,
                    accessory: cycle(avatar.accessory, -1, AVATAR_LIMITS.accessory),
                  })
                }
                onNext={() =>
                  setAvatar({
                    ...avatar,
                    accessory: cycle(avatar.accessory, 1, AVATAR_LIMITS.accessory),
                  })
                }
              />
            </View>
          </View>
        ) : null}

        {step === 'profil' ? (
          <View className="gap-5">
            <Header title="Vous êtes…" subtitle="Cela change ce que TK LINK vous propose." />

            <View className="gap-2">
              <Choice
                testID="holder-particulier"
                icon="user"
                title="Un particulier"
                detail="Vos tickets, vos points, vos cadeaux."
                selected={holderType === 'particulier'}
                onPress={() => setHolderType('particulier')}
              />
              <Choice
                testID="holder-pro"
                icon="briefcase"
                title="Un professionnel"
                detail="Vos tickets deviennent des factures, prêtes pour votre comptable."
                selected={holderType === 'pro'}
                onPress={() => setHolderType('pro')}
              />
            </View>

            <View className="gap-2">
              <AppText className="font-sans-semibold text-ink">Votre support</AppText>
              <Choice
                testID="medium-carte"
                icon="credit-card"
                title="La carte TK LINK"
                detail="Remise par votre commerçant ou votre comptable."
                selected={medium === 'carte'}
                onPress={() => setMedium('carte')}
              />
              <Choice
                testID="medium-pastille"
                icon="disc"
                title="La pastille"
                detail="Collée sur votre carte bancaire — rien de plus à sortir."
                selected={medium === 'pastille'}
                onPress={() => setMedium('pastille')}
              />
            </View>
          </View>
        ) : null}

        {step === 'interets' ? (
          <View className="gap-5">
            <Header
              title="Presque fini"
              subtitle="Votre prénom, et ce qui vous intéresse — pour trier vos offres."
            />

            <View className="gap-2">
              <AppText variant="caption" className="text-ink-muted">
                Votre prénom
              </AppText>
              <TextInput
                testID="onboarding-firstname"
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Ex. Sofiane"
                placeholderTextColor={colors.inkFaint}
                className="rounded-control bg-surface-muted px-4 font-sans text-ink"
                style={{ height: 50, fontSize: 16 }}
                autoCapitalize="words"
                returnKeyType="done"
                accessibilityLabel="Votre prénom"
              />
            </View>

            <View className="gap-2">
              <AppText variant="caption" className="text-ink-muted">
                Ce que vous achetez le plus
              </AppText>
              <View className="flex-row flex-wrap gap-2">
                {INTERESTS.map((it) => {
                  const on = interests.includes(it.key);
                  return (
                    <Pressable
                      key={it.key}
                      testID={`interest-${it.key}`}
                      accessibilityRole="button"
                      accessibilityLabel={it.label}
                      onPress={() => toggle(it.key)}
                      className={cn(
                        'flex-row items-center gap-2 rounded-pill px-4 py-2.5',
                        on ? 'bg-brand-500' : 'bg-surface-muted',
                      )}
                    >
                      <Feather
                        name={it.icon as 'heart'}
                        size={15}
                        color={on ? colors.inkInverse : colors.inkMuted}
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
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Barre d'action */}
      <View className="gap-2 px-5 pt-2" style={{ paddingBottom: insets.bottom + 12 }}>
        <Pressable
          testID="onboarding-next"
          accessibilityRole="button"
          accessibilityLabel={isLast ? 'Commencer' : 'Continuer'}
          disabled={!canContinue}
          onPress={next}
          className={cn(
            'items-center rounded-control py-4',
            canContinue ? 'bg-brand-500 active:bg-brand-600' : 'bg-surface-sunken',
          )}
        >
          <AppText
            className={cn('font-sans-bold', canContinue ? 'text-ink-inverse' : 'text-ink-faint')}
          >
            {isLast ? 'Commencer' : 'Continuer'}
          </AppText>
        </Pressable>

        {isLast && !canContinue ? (
          <AppText variant="caption" className="text-center text-ink-faint">
            Indiquez votre prénom et au moins un centre d’intérêt.
          </AppText>
        ) : null}

        {index > 0 ? (
          <Pressable
            testID="onboarding-back"
            accessibilityRole="button"
            accessibilityLabel="Étape précédente"
            onPress={() => setStep(STEPS[index - 1]!)}
            className="items-center py-2"
          >
            <AppText variant="caption" className="text-ink-muted">
              Retour
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/* ---------------------------------------------------------------- morceaux */

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View className="gap-1.5">
      <AppText variant="display" className="text-3xl">
        {title}
      </AppText>
      <AppText variant="caption">{subtitle}</AppText>
    </View>
  );
}

/** L'accroche : les chiffres de la marque, rendus concrets. */
function ImpactStep() {
  return (
    <View className="gap-5">
      <View className="gap-1.5">
        <AppText variant="display" className="text-3xl">
          Le ticket papier{'\n'}a fait son temps.
        </AppText>
        <AppText variant="caption">Chaque année, en France.</AppText>
      </View>

      <View className="overflow-hidden rounded-card bg-surface-inverse p-5">
        <View className="gap-4">
          <Stat value="30 milliards" label="de tickets de caisse imprimés" />
          <Stat value="1,8 million" label="d’arbres abattus" />
          <Stat value="75 milliards" label="de litres d’eau consommés" />
        </View>
      </View>

      <View className="flex-row items-start gap-3 rounded-card bg-brand-50 p-4">
        <Feather name="check-circle" size={20} color={colors.brand600} />
        <AppText variant="caption" className="flex-1 text-brand-700">
          Avec TK LINK, votre ticket arrive directement dans l’app. Rien à imprimer, rien à perdre —
          et vos achats vous rapportent des points.
        </AppText>
      </View>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View className="gap-0.5">
      <AppText
        className="font-display text-lime"
        style={{ fontSize: 24, fontVariant: ['tabular-nums'] }}
      >
        {value}
      </AppText>
      <AppText variant="caption" className="text-ink-inverse/70">
        {label}
      </AppText>
    </View>
  );
}

function Picker({
  testID,
  label,
  value,
  onPrev,
  onNext,
}: {
  testID: string;
  label: string;
  value: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <View className="flex-row items-center justify-between rounded-control bg-surface-muted px-2 py-2">
      <Pressable
        testID={`${testID}-prev`}
        accessibilityRole="button"
        accessibilityLabel={`${label} précédent`}
        hitSlop={8}
        onPress={onPrev}
        className="h-9 w-9 items-center justify-center rounded-pill bg-surface"
      >
        <Feather name="chevron-left" size={18} color={colors.ink} />
      </Pressable>
      <View className="items-center">
        <AppText variant="caption" className="text-ink-faint" style={{ fontSize: 11 }}>
          {label}
        </AppText>
        <AppText className="font-sans-semibold text-ink" style={{ fontSize: 14 }}>
          {value}
        </AppText>
      </View>
      <Pressable
        testID={`${testID}-next`}
        accessibilityRole="button"
        accessibilityLabel={`${label} suivant`}
        hitSlop={8}
        onPress={onNext}
        className="h-9 w-9 items-center justify-center rounded-pill bg-surface"
      >
        <Feather name="chevron-right" size={18} color={colors.ink} />
      </Pressable>
    </View>
  );
}

function Choice({
  testID,
  icon,
  title,
  detail,
  selected,
  onPress,
}: {
  testID: string;
  icon: 'user' | 'briefcase' | 'credit-card' | 'disc';
  title: string;
  detail: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      className={cn(
        'flex-row items-center gap-3 rounded-card p-4',
        selected ? 'bg-brand-50' : 'bg-surface-muted',
      )}
      style={{ borderWidth: 1, borderColor: selected ? colors.brand500 : 'transparent' }}
    >
      <View
        className="h-10 w-10 items-center justify-center rounded-control"
        style={{ backgroundColor: selected ? colors.brand500 : colors.surface }}
      >
        <Feather name={icon} size={18} color={selected ? colors.inkInverse : colors.inkMuted} />
      </View>
      <View className="flex-1">
        <AppText className="font-sans-semibold text-ink">{title}</AppText>
        <AppText variant="caption" style={{ fontSize: 12 }}>
          {detail}
        </AppText>
      </View>
      {selected ? <Feather name="check" size={18} color={colors.brand600} /> : null}
    </Pressable>
  );
}
