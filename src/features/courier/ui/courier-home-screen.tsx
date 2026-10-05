import { Feather } from '@expo/vector-icons';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText, Button, Screen, ThemeToggle } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

import { formatEur } from '../lib/courier';
import { daySummary, deltaLabel } from '../lib/summary';
import { useCourierStore } from '../model/store';

export type CourierTarget = 'missions' | 'history' | 'support' | 'account' | 'security' | 'setup';

type Props = {
  /** « Alex Martin » — le nom affiché en haut. */
  name: string;
  /** La photo de profil — fournie par la route (la galerie vit dans `onboarding`). */
  renderAvatar?: () => ReactNode;
  /** Missions proposées en ce moment (« en attente », « à prendre »). */
  pendingCount: number;
  /** Une conversation non lue, ou une mission en attente : l'écran s'ouvre là. */
  onOpen: (target: CourierTarget) => void;
  /**
   * Démo : activer un compte livreur d'exemple en un geste, quand le compte n'est pas encore
   * validé. Absent en production.
   */
  showExamples?: boolean;
};

const SHORTCUTS: {
  key: Exclude<CourierTarget, 'setup'>;
  label: string;
  icon: ComponentProps<typeof Feather>['name'];
}[] = [
  { key: 'missions', label: 'Mes missions', icon: 'clipboard' },
  { key: 'history', label: 'Historique', icon: 'clock' },
  { key: 'support', label: 'Support', icon: 'headphones' },
  { key: 'account', label: 'Compte', icon: 'user' },
  { key: 'security', label: 'Sécurité', icon: 'shield' },
];

const DAY_LABEL = (ms: number) =>
  new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

/**
 * L'ACCUEIL DU LIVREUR — la première maquette du client : qui je suis et si je suis disponible,
 * le résumé du jour (gains, missions en attente, livraisons terminées), les raccourcis, et le
 * bouton pour passer disponible.
 *
 * Les chiffres viennent de l'historique de l'appareil : « +12,5 % vs hier » n'apparaît que
 * si hier a quelque chose à comparer.
 */
export function CourierHomeScreen({
  name,
  renderAvatar,
  pendingCount,
  onOpen,
  showExamples = false,
}: Props) {
  const colors = useColors();
  const status = useCourierStore((s) => s.status);
  const online = useCourierStore((s) => s.online);
  const active = useCourierStore((s) => s.active);
  const history = useCourierStore((s) => s.history);
  const setOnline = useCourierStore((s) => s.setOnline);
  const submitProfile = useCourierStore((s) => s.submitProfile);
  const validateAccount = useCourierStore((s) => s.validateAccount);
  const setDeviceEnrolled = useCourierStore((s) => s.setDeviceEnrolled);

  // Instant figé au montage : pas d'horloge pendant le rendu.
  const [now] = useState(() => Date.now());
  const [message, setMessage] = useState<string | null>(null);

  const ready = status === 'valide';
  const summary = daySummary(history, now);
  const inProgress = pendingCount + (active ? 1 : 0);

  const toggle = () => {
    if (!setOnline(!online)) {
      setMessage(
        online
          ? 'Terminez la mission en cours avant de passer hors ligne.'
          : 'Votre compte doit être validé pour recevoir des missions.',
      );
    } else {
      setMessage(null);
    }
  };

  // Démo : un compte prêt à livrer en un geste, sans passer par les justificatifs.
  const activateDemo = () => {
    submitProfile({ vehicle: 'velo', zone: 'Toulouse', idUri: 'demo', selfieUri: 'demo' });
    validateAccount();
    setDeviceEnrolled(true);
    setOnline(true);
  };

  const tiles: { id: string; label: string; value: string; sub: string; accent?: boolean }[] = [
    {
      id: 'gains',
      label: 'Gains du jour',
      value: formatEur(summary.gainsEur),
      sub: deltaLabel(summary.gainsDeltaPct) ?? ' ',
      accent: true,
    },
    {
      id: 'pending',
      label: 'Missions en attente',
      value: String(pendingCount),
      sub: 'À prendre',
    },
    {
      id: 'done',
      label: 'Livraisons terminées',
      value: String(summary.deliveries),
      sub: deltaLabel(summary.deliveriesDeltaPct) ?? ' ',
      accent: true,
    },
  ];

  return (
    <Screen testID="courier-home-screen" padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-4 px-5 pb-28">
        {/* Qui je suis, et suis-je disponible */}
        <View className="flex-row items-center gap-3 pt-3">
          <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-pill border-2 border-brand-500 bg-surface-muted">
            {renderAvatar ? (
              renderAvatar()
            ) : (
              <Feather name="user" size={24} color={colors.brand500} />
            )}
          </View>
          <View className="flex-1">
            <AppText testID="courier-name" variant="title" className="text-lg" numberOfLines={1}>
              {name}
            </AppText>
            <View className="flex-row items-center gap-1.5">
              <View
                className={cn('h-2 w-2 rounded-pill', online ? 'bg-success' : 'bg-ink-faint')}
              />
              <AppText
                testID="courier-availability"
                variant="caption"
                className={online ? 'text-success' : 'text-ink-faint'}
              >
                {online ? 'Disponible' : 'Hors ligne'}
              </AppText>
            </View>
          </View>
          <View className="items-end gap-2">
            <Pressable
              testID="courier-bell"
              accessibilityRole="button"
              accessibilityLabel={
                pendingCount > 0
                  ? `${pendingCount} mission${pendingCount > 1 ? 's' : ''} en attente`
                  : 'Missions'
              }
              hitSlop={8}
              onPress={() => onOpen('missions')}
            >
              <Feather name="bell" size={20} color={colors.ink} />
              {pendingCount > 0 ? (
                <View className="absolute -right-1.5 -top-1.5 h-4 min-w-[16px] items-center justify-center rounded-pill bg-brand-500 px-1">
                  <AppText className="font-sans-bold text-white" style={{ fontSize: 9 }}>
                    {pendingCount}
                  </AppText>
                </View>
              ) : null}
            </Pressable>
            <ThemeToggle />
          </View>
        </View>

        {!ready && showExamples ? (
          <Pressable
            testID="courier-demo-activate"
            accessibilityRole="button"
            onPress={activateDemo}
            className="items-center rounded-control border border-dashed border-brand-500 py-3.5"
          >
            <AppText className="font-sans-semibold text-brand-600" style={{ fontSize: 13.5 }}>
              Démo — activer un compte livreur d’exemple
            </AppText>
          </Pressable>
        ) : null}

        {!ready ? (
          <Pressable
            testID="courier-open-setup"
            accessibilityRole="button"
            onPress={() => onOpen('setup')}
            className="flex-row items-center gap-3 rounded-card bg-brand-50 p-4"
          >
            <Feather name="shield" size={18} color={colors.brand600} />
            <View className="flex-1">
              <AppText className="font-sans-bold text-brand-700">Terminer mon inscription</AppText>
              <AppText variant="caption" className="text-brand-700">
                Identité, véhicule et sécurité : il manque encore quelques étapes.
              </AppText>
            </View>
            <Feather name="chevron-right" size={18} color={colors.brand600} />
          </Pressable>
        ) : null}

        {/* Résumé du jour */}
        <View className="gap-3 rounded-card border border-line bg-surface p-4">
          <View>
            <AppText className="font-sans-bold text-ink">Résumé du jour</AppText>
            <AppText variant="caption" className="text-ink-faint">
              Aujourd’hui, {DAY_LABEL(now)}
            </AppText>
          </View>
          <View className="flex-row gap-2">
            {tiles.map((t) => (
              <View
                key={t.id}
                testID={`courier-tile-${t.id}`}
                className="flex-1 gap-0.5 rounded-card border border-brand-500 bg-surface-muted px-2 py-3"
              >
                <AppText
                  variant="caption"
                  className="text-center text-ink-muted"
                  style={{ fontSize: 10.5 }}
                  numberOfLines={2}
                >
                  {t.label}
                </AppText>
                <AppText
                  testID={`courier-tile-${t.id}-value`}
                  className="text-center font-display text-ink"
                  style={{ fontSize: 22 }}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {t.value}
                </AppText>
                <AppText
                  variant="caption"
                  className={cn('text-center', t.accent ? 'text-success' : 'text-ink-faint')}
                  style={{ fontSize: 10 }}
                  numberOfLines={1}
                >
                  {t.sub}
                </AppText>
              </View>
            ))}
          </View>
        </View>

        {/* Raccourcis */}
        <View className="gap-3 rounded-card border border-line bg-surface p-4">
          <AppText className="font-sans-bold text-ink">Raccourcis</AppText>
          <View className="flex-row flex-wrap gap-2">
            {SHORTCUTS.map((s) => {
              const sub =
                s.key === 'missions'
                  ? `${inProgress} en cours`
                  : s.key === 'history'
                    ? 'Voir mes livraisons'
                    : s.key === 'support'
                      ? 'Aide & contact'
                      : s.key === 'account'
                        ? 'Mon profil'
                        : 'Paramètres & accès';
              return (
                <Pressable
                  key={s.key}
                  testID={`courier-shortcut-${s.key}`}
                  accessibilityRole="button"
                  accessibilityLabel={s.label}
                  onPress={() => onOpen(s.key)}
                  className={cn(
                    'flex-row items-center gap-3 rounded-card border border-line bg-surface-muted px-3 py-3 active:opacity-70',
                    s.key === 'security' ? 'w-full' : 'w-[48.5%]',
                  )}
                >
                  <View className="h-10 w-10 items-center justify-center rounded-control border border-brand-500">
                    <Feather name={s.icon} size={18} color={colors.brand500} />
                  </View>
                  <View className="flex-1">
                    <AppText className="font-sans-semibold text-ink" style={{ fontSize: 13 }}>
                      {s.label}
                    </AppText>
                    <AppText
                      variant="caption"
                      className="text-ink-faint"
                      style={{ fontSize: 10.5 }}
                      numberOfLines={1}
                    >
                      {sub}
                    </AppText>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {message ? (
          <AppText testID="courier-message" variant="caption" className="text-danger">
            {message}
          </AppText>
        ) : null}

        <Button
          testID="courier-online-toggle"
          label={online ? 'Passer hors ligne' : 'Passer disponible'}
          variant={online ? 'secondary' : 'primary'}
          disabled={!ready}
          onPress={toggle}
        />
      </ScrollView>
    </Screen>
  );
}
