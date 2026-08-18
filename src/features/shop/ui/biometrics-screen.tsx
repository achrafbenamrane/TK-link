import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Switch, View } from 'react-native';

import { AppText, Screen } from '@/shared/ui';
import { BackButton } from '@/shared/ui/back-button';
import { colors } from '@/shared/theme/colors';

import { authenticate, getBiometricSupport, type BiometricSupport } from '../lib/biometrics';
import { useShopStore } from '../model/store';
import { FingerprintScanner, type ScanState } from './components/fingerprint-scanner';

export function BiometricsScreen() {
  const enabled = useShopStore((s) => s.biometricEnabled);
  const setEnabled = useShopStore((s) => s.setBiometricEnabled);

  const [support, setSupport] = useState<BiometricSupport | null>(null);
  const [scan, setScan] = useState<ScanState>('repos');

  useEffect(() => {
    let alive = true;
    getBiometricSupport().then((s) => {
      if (alive) setSupport(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  const runScan = useCallback(
    async (reason: string) => {
      setScan('scan');
      const result = await authenticate(reason);
      setScan(result.ok ? 'ok' : 'echec');
      // On laisse l'état visible un instant avant de revenir au repos.
      setTimeout(() => setScan('repos'), result.ok ? 1200 : 900);
      return result.ok;
    },
    [setScan],
  );

  const onToggle = async (next: boolean) => {
    // Activer exige une vérification réussie : sinon n'importe qui pourrait
    // verrouiller (ou déverrouiller) le compte d'un autre.
    if (next) {
      const ok = await runScan('Confirmez votre identité pour activer le déverrouillage');
      if (ok) setEnabled(true);
      return;
    }
    setEnabled(false);
  };

  const unavailableReason = !support
    ? null
    : !support.hasHardware
      ? 'Ce téléphone n’a pas de capteur biométrique.'
      : !support.isEnrolled
        ? 'Aucune empreinte n’est enregistrée dans les réglages du téléphone.'
        : null;

  return (
    <Screen testID="biometrics-screen">
      <View className="pb-2 pt-2">
        <BackButton fallbackHref="/profil" />
        <AppText variant="display" className="text-3xl">
          Empreinte
        </AppText>
        <AppText variant="caption" className="mt-1">
          Déverrouillez TK LINK d’un doigt.
        </AppText>
      </View>

      <View className="mt-6 items-center">
        <FingerprintScanner
          testID="fingerprint-scanner"
          state={scan}
          onPress={() => runScan('Confirmez votre identité')}
        />
      </View>

      <View className="mt-8 gap-3">
        <View className="flex-row items-center gap-3 rounded-card border border-line bg-surface p-4">
          <View className="flex-1">
            <AppText className="font-sans-bold text-ink">Déverrouillage biométrique</AppText>
            <AppText variant="caption" className="mt-0.5">
              {unavailableReason ?? 'Demander l’empreinte à chaque ouverture de l’application.'}
            </AppText>
          </View>
          <Switch
            testID="biometric-toggle"
            value={enabled}
            onValueChange={onToggle}
            disabled={Boolean(unavailableReason)}
            trackColor={{ false: colors.surfaceSunken, true: colors.brand500 }}
            thumbColor={colors.surface}
          />
        </View>

        {/* Ce que la biométrie prouve — et ce qu'elle ne prouve pas. Le dire dans
            l'app évite de laisser croire qu'on « capture » une empreinte. */}
        <View className="flex-row gap-3 rounded-card border border-line bg-surface-muted p-4">
          <Feather name="shield" size={17} color={colors.inkMuted} />
          <View className="flex-1 gap-1">
            <AppText className="font-sans-semibold text-ink">
              Votre empreinte reste chez vous
            </AppText>
            <AppText variant="caption">
              Elle ne quitte jamais la zone sécurisée de votre téléphone. TK LINK ne la voit pas, ne
              l’enregistre pas et ne l’envoie nulle part : le téléphone répond simplement « c’est
              bien vous ».
            </AppText>
          </View>
        </View>
      </View>
    </Screen>
  );
}
