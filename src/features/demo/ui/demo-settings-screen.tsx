import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';

import { PLATFORM_SETTINGS } from '@/shared/lib/platform-settings';
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
  /** La valeur arrêtée, montrée tant qu'on n'a rien essayé. */
  original: number;
};

function Field({ field, label, hint, unit, effect, original }: FieldProps) {
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
          placeholder={`${original}`}
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
 * LES RÉGLAGES DE DÉMONSTRATION — deux valeurs que le cahier des charges ne chiffre pas, à
 * essayer devant le client : le forfait de livraison payé par le client et la zone de base au-delà
 * de laquelle chaque km se paie. Chaque ligne dit ce que la valeur change dans l'app.
 *
 * Les valeurs d'origine ont été arrêtées le 24/10/2026 (voir `PLATFORM_SETTINGS`) ; cet écran ne
 * sert qu'à essayer d'autres montants sur cet appareil, sans toucher au code. La zone de base du
 * livreur et le « colis important » ont disparu le 13/11/2026 avec les livreurs (Uber Direct).
 */
export function DemoSettingsScreen() {
  const settings = usePlatformSettings();
  const reset = usePlatformOverrides((s) => s.reset);
  // Remonte les champs à zéro quand on remet tout à zéro.
  const [epoch, setEpoch] = useState(0);

  const fee = settings.deliveryFeeEur;
  const zone = settings.deliveryBaseZoneKm;
  const sampleKm = 3.8;

  // Même calcul que le panier (`clientDeliveryFee`, feature `shop`, qu'une feature voisine
  // n'importe pas) : le forfait, puis le prix du km au-delà de la zone de base.
  const longFee =
    zone === null
      ? `${eur(fee)} (sans zone de base, aucune majoration)`
      : eur(
          Math.round((fee + Math.max(0, sampleKm - zone) * settings.deliveryPerKmEur) * 100) / 100,
        );

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
            Des valeurs que le cahier des charges ne chiffre pas, arrêtées le 24/10/2026. Essayez-en
            d’autres ici : cela ne change que cet appareil.
          </AppText>
        </View>

        <Field
          key={`fee-${epoch}`}
          field="deliveryFeeEur"
          label="Frais de livraison payés par le client"
          hint="Valeur arrêtée : 3,00 €. Le Touch & Collect reste gratuit."
          original={PLATFORM_SETTINGS.deliveryFeeEur}
          unit="€"
          effect={`Un client livré paie ${fee === 0 ? 'rien (livraison offerte)' : eur(fee)}.`}
        />
        <Field
          key={`zone-${epoch}`}
          field="deliveryBaseZoneKm"
          label="Zone de base de la livraison"
          hint="Au-delà de cette distance, chaque km coûte 0,80 € de plus au client."
          unit="km"
          original={PLATFORM_SETTINGS.deliveryBaseZoneKm ?? 0}
          effect={`Une livraison à ${String(sampleKm).replace('.', ',')} km coûte ${longFee} au client.`}
        />

        <Button
          testID="demo-reset"
          label="Revenir aux valeurs arrêtées"
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
