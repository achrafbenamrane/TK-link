import { Feather } from '@expo/vector-icons';
import { useMemo, useState, type ComponentProps } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cn } from '@/shared/lib/cn';
import { APP_ROLES, ROLE_ICON, ROLE_LABEL, ROLE_TAGLINE, type Role } from '@/shared/lib/roles';
import { AppText } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { canFinish, INTERESTS, randomAvatar } from '../lib/avatar';
import { AVATARS } from '../model/avatars';
import {
  selectAvatar,
  selectFirstName,
  selectInterests,
  selectRole,
  useOnboardingStore,
} from '../model/store';
import { AvatarView } from './avatar-view';

/** Où l'on va une fois l'accueil des nouveaux terminé. */
export type OnboardingExit = 'app' | 'sign-up' | 'sign-in';

type Props = {
  /**
   * Fin du parcours. La destination est décidée ICI mais TRADUITE par la
   * route : la feature ne connaît aucune URL.
   */
  onDone: (next: OnboardingExit) => void;
  /**
   * Une session existe déjà (fourni par la route — `auth` n'est pas importée
   * ici). L'étape « compte » disparaît alors : proposer de créer un compte à
   * quelqu'un qui vient de se connecter est au mieux inutile, au pire
   * inquiétant.
   */
  hasAccount?: boolean;
};

type Step = 'impact' | 'role' | 'avatar' | 'profil' | 'interets' | 'compte';

/**
 * Les étapes, adaptées au rôle — CDC §4 : « L'onboarding devra être adapté au
 * rôle sélectionné. »
 *
 * **Le compte vient AVANT la personnalisation.** Rôle, avatar et centres
 * d'intérêt décrivent quelqu'un ; tant que ce quelqu'un n'a pas de compte, ils
 * ne décrivent qu'un téléphone. Les recueillir d'abord, c'était demander un
 * quart d'heure de réglages puis, à la fin, un mot de passe — et perdre le
 * tout si la personne fermait l'app.
 *
 * Le SIRET ne s'y oppose pas, contrairement à ce qu'on avait supposé. Le CDC
 * §5 est explicite : « l'accès et la consultation des offres se font avec les
 * mêmes informations, mais pour passer commande, le SIRET doit être
 * renseigné ». Il n'est donc PAS exigé à l'inscription — c'est la commande qui
 * le réclame, et cette garde existe déjà (`merchant/model/store.ts`).
 *
 * L'écran d'impact reste en tête : c'est lui qui donne une raison de créer le
 * compte. Réclamer un mot de passe avant d'avoir rien montré reste le meilleur
 * moyen de perdre quelqu'un.
 *
 * L'étape « profil » demande particulier ou professionnel : la question n'a de
 * sens que pour un consommateur. Un commerçant ou un grossiste est un
 * professionnel par définition, lui poser la question serait un faux choix.
 */
function stepsFor(role: Role, hasAccount: boolean): Step[] {
  const after: Step[] =
    role === 'consommateur'
      ? ['role', 'avatar', 'profil', 'interets']
      : ['role', 'avatar', 'interets'];
  return hasAccount ? ['impact', ...after] : ['impact', 'compte', ...after];
}

/** Ce que l'étape « intérêts » veut dire selon le rôle. */
const INTEREST_COPY: Record<
  Role,
  { title: string; subtitle: string; subtitleNamed: string; label: string }
> = {
  consommateur: {
    title: 'Presque fini',
    subtitle: 'Votre prénom, et ce qui vous intéresse — pour trier vos offres.',
    subtitleNamed: 'Ce qui vous intéresse — pour trier vos offres.',
    label: 'Ce que vous achetez le plus',
  },
  commercant: {
    title: 'Votre commerce',
    subtitle: 'Votre prénom, et vos rayons — pour vous montrer les bons lots.',
    subtitleNamed: 'Vos rayons — pour vous montrer les bons lots.',
    label: 'Ce que vous vendez',
  },
  grossiste: {
    title: 'Votre activité',
    subtitle: 'Votre prénom, et vos rayons — pour cibler les bons commerçants.',
    subtitleNamed: 'Vos rayons — pour cibler les bons commerçants.',
    label: 'Ce que vous distribuez',
  },
};

export function OnboardingScreen({ onDone, hasAccount = false }: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('impact');

  const firstName = useOnboardingStore(selectFirstName);
  const avatar = useOnboardingStore(selectAvatar);
  const interests = useOnboardingStore(selectInterests);
  const role = useOnboardingStore(selectRole);
  const holderType = useOnboardingStore((s) => s.holderType);
  const medium = useOnboardingStore((s) => s.medium);

  const setFirstName = useOnboardingStore((s) => s.setFirstName);
  const setAvatar = useOnboardingStore((s) => s.setAvatar);
  const setRole = useOnboardingStore((s) => s.setRole);
  const setHolderType = useOnboardingStore((s) => s.setHolderType);
  const setMedium = useOnboardingStore((s) => s.setMedium);
  const toggle = useOnboardingStore((s) => s.toggleInterest);
  const complete = useOnboardingStore((s) => s.complete);

  const steps = useMemo(() => stepsFor(role, hasAccount), [role, hasAccount]);
  // `indexOf` peut renvoyer -1 si le rôle vient de retirer l'étape courante :
  // on retombe alors sur le début plutôt que de calculer sur un index négatif.
  const index = Math.max(0, steps.indexOf(step));
  const isLast = index === steps.length - 1;
  // Le prénom et les intérêts sont exigés à l'étape qui les demande, pas à la
  // fin : sinon le bouton se bloque sur l'écran du compte, loin des champs à
  // remplir, et plus rien n'indique quoi corriger.
  const canContinue = step === 'interets' ? canFinish(firstName, interests) : true;
  const copy = INTEREST_COPY[role];
  const onAccountStep = step === 'compte';
  /**
   * L'inscription a-t-elle déjà donné le prénom ?
   *
   * Gelé au montage : sans cela, le champ disparaîtrait sous les doigts de
   * quelqu'un qui n'a pas de compte, à la première lettre tapée.
   */
  const [knowsName] = useState(() => firstName.trim().length > 0);
  const label = onAccountStep ? 'Continuer sans compte' : isLast ? 'Commencer' : 'Continuer';

  /** Clôt l'accueil des nouveaux et dit à la route où aller ensuite. */
  const finish = (exit: OnboardingExit) => {
    complete();
    onDone(exit);
  };

  const next = () => {
    if (isLast) {
      finish('app');
      return;
    }
    setStep(steps[index + 1]!);
  };

  return (
    <View
      testID="onboarding-screen"
      className="flex-1 bg-surface"
      style={{ paddingTop: insets.top }}
    >
      {/* Progression */}
      <View className="flex-row gap-1.5 px-5 pb-1 pt-3">
        {steps.map((s, i) => (
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

        {/* CDC §4 — le choix du rôle, avant tout le reste. */}
        {step === 'role' ? (
          <View className="gap-5">
            <Header
              title="Vous venez pour…"
              subtitle="Ce choix décide des offres que vous verrez."
            />
            <View className="gap-2">
              {APP_ROLES.map((r) => (
                <Choice
                  key={r}
                  testID={`role-${r}`}
                  icon={ROLE_ICON[r] as 'user'}
                  title={ROLE_LABEL[r]}
                  detail={ROLE_TAGLINE[r]}
                  selected={role === r}
                  onPress={() => setRole(r)}
                />
              ))}
            </View>
            <View className="flex-row items-start gap-2.5 rounded-card bg-surface-muted p-3.5">
              <Feather name="info" size={15} color={colors.inkFaint} />
              <AppText variant="caption" className="flex-1 text-ink-muted" style={{ fontSize: 12 }}>
                {role === 'consommateur'
                  ? 'Vous verrez les offres des commerçants près de chez vous.'
                  : 'Vous verrez les lots des grossistes. Votre SIRET est exigé pour commander, et vos ventes se pilotent depuis l’espace pro sur le web.'}
              </AppText>
            </View>
          </View>
        ) : null}

        {step === 'avatar' ? (
          <View className="gap-5">
            <Header
              title="Votre avatar"
              subtitle="Il vous suivra sur votre carte, dans La Chasse et dans les jeux."
            />
            <View className="items-center gap-4">
              <AvatarView avatar={avatar} size={128} />
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

            {/* La galerie entière, visible d'un coup : dix illustrations se
                parcourent à l'œil bien plus vite qu'avec des flèches. */}
            <View className="flex-row flex-wrap justify-between gap-y-3">
              {AVATARS.map((a, i) => {
                const selected = avatar.preset === i;
                return (
                  <Pressable
                    key={a.id}
                    testID={`avatar-${a.id}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={a.label}
                    onPress={() => setAvatar({ preset: i })}
                    className={cn(
                      'w-[22%] items-center gap-1 rounded-card border p-1.5',
                      selected ? 'border-brand-500 bg-brand-50' : 'border-transparent',
                    )}
                  >
                    <AvatarView avatar={{ preset: i }} size={56} />
                    <AppText
                      className={cn(
                        'text-center',
                        selected ? 'font-sans-semibold text-brand-700' : 'text-ink-faint',
                      )}
                      style={{ fontSize: 9.5, lineHeight: 12 }}
                      numberOfLines={2}
                    >
                      {a.label}
                    </AppText>
                  </Pressable>
                );
              })}
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
              title={knowsName && firstName ? `Presque fini, ${firstName}` : copy.title}
              subtitle={knowsName ? copy.subtitleNamed : copy.subtitle}
            />

            {/* Le prénom n'est demandé que si l'inscription ne l'a pas déjà
                donné. Poser deux fois la même question à deux écrans d'écart
                donne l'impression que rien n'a été retenu — et sur un
                formulaire, c'est la première raison d'abandonner. */}
            {knowsName ? null : (
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
            )}

            <View className="gap-2">
              <AppText variant="caption" className="text-ink-muted">
                {copy.label}
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

        {/* CDC §5 — le compte, une fois qu'on sait à qui l'on parle. */}
        {step === 'compte' ? (
          <View className="gap-5">
            <Header
              title={firstName ? `Enchanté, ${firstName}` : 'Votre compte'}
              subtitle="Créez votre compte pour garder vos points, vos coupons et votre carte — même en changeant de téléphone."
            />

            {/* Ce que le compte apporte, en trois lignes.
                Cet emplacement montrait auparavant l'avatar et les centres
                d'intérêt déjà choisis — un récapitulatif. Le compte passant
                désormais AVANT la personnalisation, il n'y a plus rien à
                récapituler : on donne donc une raison de le créer plutôt qu'un
                miroir de ce qui n'existe pas encore. */}
            <View
              testID="onboarding-account-perks"
              className="gap-2.5 rounded-card bg-surface-muted p-4"
            >
              {[
                {
                  icon: 'award',
                  text: 'Vos points et vos coupons vous suivent, même en changeant de téléphone.',
                },
                { icon: 'credit-card', text: 'Votre carte de fidélité, avec votre avatar dessus.' },
                {
                  icon: 'zap',
                  text: 'Les ventes flash près de chez vous, triées selon ce qui vous intéresse.',
                },
              ].map((perk) => (
                <View key={perk.icon} className="flex-row items-start gap-3">
                  <Feather name={perk.icon as 'award'} size={15} color={colors.brand600} />
                  <AppText
                    variant="caption"
                    className="flex-1 text-ink-muted"
                    style={{ fontSize: 12.5 }}
                  >
                    {perk.text}
                  </AppText>
                </View>
              ))}
            </View>

            <View className="gap-2">
              <Pressable
                testID="onboarding-signup"
                accessibilityRole="button"
                accessibilityLabel="Créer mon compte"
                onPress={() => finish('sign-up')}
                className="flex-row items-center justify-center gap-2 rounded-control bg-brand-500 py-4 active:bg-brand-600"
              >
                <AppText className="font-sans-bold text-ink-inverse" style={{ fontSize: 15 }}>
                  Créer mon compte
                </AppText>
                <Feather name="arrow-right" size={17} color={colors.inkInverse} />
              </Pressable>

              <Pressable
                testID="onboarding-signin"
                accessibilityRole="button"
                accessibilityLabel="J’ai déjà un compte"
                onPress={() => finish('sign-in')}
                className="items-center rounded-control border border-line py-4 active:bg-surface-muted"
              >
                <AppText className="font-sans-bold text-ink" style={{ fontSize: 15 }}>
                  J’ai déjà un compte
                </AppText>
              </Pressable>
            </View>

            <View className="flex-row items-start gap-2.5 rounded-card bg-surface-muted p-3.5">
              <Feather name="shield" size={15} color={colors.inkFaint} />
              <AppText variant="caption" className="flex-1 text-ink-muted" style={{ fontSize: 12 }}>
                Sans compte, vos points et vos coupons ne vivent que sur ce téléphone : les
                désinstaller les efface.
              </AppText>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Barre d'action */}
      <View className="gap-2 px-5 pt-2" style={{ paddingBottom: insets.bottom + 12 }}>
        {/* Sur l'étape du compte, les actions principales sont au-dessus : ce
            bouton y devient la sortie discrète, pas l'appel à l'action. */}
        <Pressable
          testID="onboarding-next"
          accessibilityRole="button"
          accessibilityLabel={label}
          disabled={!canContinue}
          onPress={next}
          className={cn(
            'items-center rounded-control',
            onAccountStep
              ? 'py-2'
              : cn('py-4', canContinue ? 'bg-brand-500 active:bg-brand-600' : 'bg-surface-sunken'),
          )}
        >
          <AppText
            className={cn(
              onAccountStep
                ? 'text-ink-muted'
                : cn('font-sans-bold', canContinue ? 'text-ink-inverse' : 'text-ink-faint'),
            )}
            style={onAccountStep ? { fontSize: 13.5 } : undefined}
          >
            {label}
          </AppText>
        </Pressable>

        {step === 'interets' && !canContinue ? (
          <AppText variant="caption" className="text-center text-ink-faint">
            {knowsName
              ? 'Choisissez au moins un centre d’intérêt.'
              : 'Indiquez votre prénom et au moins un centre d’intérêt.'}
          </AppText>
        ) : null}

        {index > 0 ? (
          <Pressable
            testID="onboarding-back"
            accessibilityRole="button"
            accessibilityLabel="Étape précédente"
            onPress={() => setStep(steps[index - 1]!)}
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

function Choice({
  testID,
  icon,
  title,
  detail,
  selected,
  onPress,
}: {
  testID: string;
  icon: ComponentProps<typeof Feather>['name'];
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
