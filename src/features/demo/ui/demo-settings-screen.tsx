import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';

import { isImportantParcel } from '@/shared/lib/handover';
import {
  type OverridableKey,
  usePlatformOverrides,
  usePlatformSettings,
} from '@/shared/lib/platform-overrides';
import { AppText, Button, Screen } from '@/shared/ui';
import { BackButton } from '@/shared/ui/back-button';
import { useColors } from '@/shared/theme/theme-provider';

const eur = (v: number) => `${v.toFixed(2).replace('.', ',')} €`;

/** « 3,8 » ou « 3.8 » → 3.8 ; vide ou illisible → `null` (la valeur « à définir » revient). */
function parse(text: string): number | null {
  const n = Number.parseFloat(text.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

type FieldProps = {
  field: OverridableKey;
  label: string;
  hint: string;
  unit: string;
  effect: string;
};

function Field({ field, label, hint, unit, effect }: FieldProps) {
  const colors = useColors();
  const value = usePlatformOverrides((s) => s.overrides[field]);
  const setOverride = usePlatformOverrides((s) => s.setOverride);
  const [text, setText] = useState(value === undefined ? '' : String(value).replace('.', ','));

  return (
    <View className="gap-2 rounded-card border border-line bg-surface p-4">
      <AppText className="font-sans-bold text-ink">{label}</AppText>
      <AppText variant="caption" className="text-ink-faint">
        {hint}
      </AppText>
      <View className="flex-row items-center gap-2">
        <TextInput
          testID={`demo-input-${field}`}
          value={text}
          onChangeText={(v) => {
            setText(v);
            setOverride(field, parse(v));
          }}
          keyboardType="decimal-pad"
          placeholder="À définir"
          placeholderTextColor={colors.inkFaint}
          accessibilityLabel={label}
          className="flex-1 rounded-control border border-line bg-surface-muted px-3.5 py-3 font-sans text-ink"
          style={{ fontSize: 16 }}
        />
        <AppText className="w-10 text-ink-muted">{unit}</AppText>
      </View>
      <AppText testID={`demo-effect-${field}`} variant="caption" className="text-brand-600">
        {effect}
      </AppText>
    </View>
  );
}

/**
 * LES RÉGLAGES DE DÉMONSTRATION — trois valeurs que le cahier des charges ne chiffre pas, à
 * essayer devant le client : ce que paie le client à la livraison, la zone de base du livreur, le
 * montant d'un « colis important ». Chaque ligne dit ce que la valeur change dans l'app.
 *
 * Ce n'est pas une décision : sans valeur, l'app garde son comportement prudent (livraison
 * offerte, gain « dès 3,00 € », empreinte exigée pour tous les colis).
 */
export function DemoSettingsScreen() {
  const settings = usePlatformSettings();
  const reset = usePlatformOverrides((s) => s.reset);
  // Remonte les champs à zéro quand on remet tout à zéro.
  const [epoch, setEpoch] = useState(0);

  const fee = settings.deliveryFeeEur;
  const zone = settings.courierBaseZoneKm;
  const parcel = settings.importantParcelMinEur;
  const sampleKm = 3.8;
  const sampleParcel = 38.5;

  const gain =
    zone === null
      ? `dès ${eur(settings.courierBaseFeeEur)} (la majoration ne se calcule pas sans zone de base)`
      : eur(
          Math.round(
            (settings.courierBaseFeeEur + Math.max(0, sampleKm - zone) * settings.courierPerKmEur) *
              100,
          ) / 100,
        );
  const identity =
    parcel === null
      ? 'exigée pour tous les colis'
      : isImportantParcel(sampleParcel, parcel)
        ? 'exigée (colis important)'
        : 'non exigée (colis courant)';

  return (
    <Screen testID="demo-settings-screen" padded={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-3 px-5 pb-10"
      >
        <View className="gap-1 pt-2">
          <BackButton fallbackHref="/" />
          <AppText variant="display" className="text-2xl">
            Réglages de démonstration
          </AppText>
          <AppText variant="caption">
            Des valeurs que le cahier des charges ne chiffre pas. Elles ne servent qu’à montrer
            l’effet : rien n’est décidé.
          </AppText>
        </View>

        <Field
          key={`fee-${epoch}`}
          field="deliveryFeeEur"
          label="Frais de livraison payés par le client"
          hint="Aujourd’hui : livraison offerte. Le Touch & Collect reste gratuit."
          unit="€"
          effect={`Un client livré paie ${fee === 0 ? 'rien (livraison offerte)' : eur(fee)}.`}
        />
        <Field
          key={`zone-${epoch}`}
          field="courierBaseZoneKm"
          label="Zone de base du livreur"
          hint="Au-delà de cette distance, le livreur touche 0,80 € par km en plus du forfait de 3 €."
          unit="km"
          effect={`Une course de ${String(sampleKm).replace('.', ',')} km rapporte ${gain}.`}
        />
        <Field
          key={`parcel-${epoch}`}
          field="importantParcelMinEur"
          label="Montant d’un colis important"
          hint="À partir de ce montant, la remise exige l’empreinte du livreur."
          unit="€"
          effect={`Pour un colis de ${eur(sampleParcel)}, l’empreinte est ${identity}.`}
        />

        <Button
          testID="demo-reset"
          label="Tout remettre à zéro"
          variant="secondary"
          onPress={() => {
            reset();
            setEpoch((e) => e + 1);
          }}
        />
      </ScrollView>
    </Screen>
  );
}
