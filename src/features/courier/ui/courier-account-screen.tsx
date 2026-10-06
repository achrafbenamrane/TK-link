import { Feather } from '@expo/vector-icons';
import { Pressable, ScrollView, View } from 'react-native';

import { AppText, Screen } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

import { VEHICLE_LABEL } from '../lib/courier';
import { useCourierStore } from '../model/store';

type Props = {
  name?: string;
  /** Reprendre ou terminer l'inscription. */
  onOpenSetup: () => void;
  /** Démo : repasser côté consommateur (en production, c'est le compte qui décide). */
  onSignOut?: () => void;
  /** Build de démonstration : ouvre les réglages à essayer devant le client. */
  onOpenDemoSettings?: () => void;
};

const STATUS_TEXT = {
  brouillon: 'Dossier à compléter',
  en_verification: 'Vérification en cours par TK LINK',
  valide: 'Compte vérifié',
} as const;

/** LE COMPTE LIVREUR — identité, véhicule, sécurité. */
export function CourierAccountScreen({ name, onOpenSetup, onSignOut, onOpenDemoSettings }: Props) {
  const colors = useColors();
  const status = useCourierStore((s) => s.status);
  const vehicle = useCourierStore((s) => s.vehicle);
  const zone = useCourierStore((s) => s.zone);
  const enrolled = useCourierStore((s) => s.deviceEnrolled);

  const rows: {
    icon: 'shield' | 'navigation' | 'map-pin' | 'lock';
    label: string;
    value: string;
  }[] = [
    { icon: 'shield', label: 'Statut', value: STATUS_TEXT[status] },
    {
      icon: 'navigation',
      label: 'Véhicule',
      value: vehicle ? VEHICLE_LABEL[vehicle] : 'Non renseigné',
    },
    { icon: 'map-pin', label: 'Zone d’activité', value: zone || 'Non renseignée' },
    {
      icon: 'lock',
      label: 'Biométrie locale',
      value: enrolled ? 'Activée sur cet appareil' : 'Non activée',
    },
  ];

  return (
    <Screen testID="courier-account-screen" padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-4 px-5 pb-10">
        <View className="pt-3">
          <AppText variant="display">Compte</AppText>
          <AppText variant="caption" className="text-ink-faint">
            {name?.trim() ? `${name} · ` : ''}TK Deliver
          </AppText>
        </View>

        <View className="rounded-card border border-line bg-surface px-4">
          {rows.map((r, i) => (
            <View
              key={r.label}
              className={`flex-row items-center gap-3 py-3.5 ${i < rows.length - 1 ? 'border-b border-line' : ''}`}
            >
              <Feather name={r.icon} size={17} color={colors.ink} />
              <AppText variant="caption" className="flex-1 text-ink-muted">
                {r.label}
              </AppText>
              <AppText className="font-sans-semibold text-ink" style={{ fontSize: 13.5 }}>
                {r.value}
              </AppText>
            </View>
          ))}
        </View>

        <AppText variant="caption" className="text-ink-faint">
          Votre empreinte reste sur ce téléphone : TK LINK n’en conserve aucune copie.
        </AppText>

        {status !== 'valide' ? (
          <Pressable
            testID="courier-account-setup"
            accessibilityRole="button"
            onPress={onOpenSetup}
            className="items-center rounded-control bg-brand-500 py-3.5 active:bg-brand-600"
          >
            <AppText className="font-sans-bold text-ink-inverse">Terminer mon inscription</AppText>
          </Pressable>
        ) : null}

        {onOpenDemoSettings ? (
          <Pressable
            testID="courier-demo-settings"
            accessibilityRole="button"
            onPress={onOpenDemoSettings}
            className="flex-row items-center justify-center gap-2 rounded-control border border-dashed border-line py-3"
          >
            <Feather name="sliders" size={16} color={colors.inkMuted} />
            <AppText className="font-sans-semibold text-ink-muted">
              Réglages de démonstration
            </AppText>
          </Pressable>
        ) : null}

        {onSignOut ? (
          <Pressable
            testID="courier-signout"
            accessibilityRole="button"
            onPress={onSignOut}
            className="flex-row items-center justify-center gap-2 py-3"
          >
            <Feather name="log-out" size={16} color={colors.brand600} />
            <AppText className="font-sans-semibold text-brand-600">Se déconnecter</AppText>
          </Pressable>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
