import { Feather } from '@expo/vector-icons';
import type * as ExpoCamera from 'expo-camera';
import { useCallback, useEffect, useRef } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { useColors } from '@/shared/theme/theme-provider';

import { Button } from './button';
import { AppText } from './text';

export type QrScannerProps = {
  /** Reçoit le contenu du QR code. Appelé une seule fois par valeur distincte sur ~1,5 s. */
  onScan: (value: string) => void;
  onClose: () => void;
  title?: string;
  testID?: string;
};

/** Fenêtre pendant laquelle une même valeur n’est pas ré-émise (la caméra relit en continu). */
const DEBOUNCE_MS = 1500;

type CameraModule = typeof ExpoCamera;

let cameraModule: CameraModule | null | undefined;

/**
 * `expo-camera` est chargé à la demande, côté natif seulement : le bundle web et les
 * tests qui importent `@/shared/ui` n’embarquent donc pas le module caméra. Si le
 * chargement échoue (module natif absent du build), on retombe sur le message de repli.
 */
function loadCamera(): CameraModule | null {
  if (cameraModule !== undefined) return cameraModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- why: chargement paresseux, natif seulement
    cameraModule = require('expo-camera') as CameraModule;
  } catch {
    cameraModule = null;
  }
  return cameraModule;
}

function Unavailable({ testID, onClose }: { testID: string; onClose: () => void }) {
  const colors = useColors();
  return (
    <View
      testID={testID}
      className="h-[260px] w-full items-center justify-center gap-3 rounded-card border border-line bg-surface-muted px-6"
    >
      <Feather name="camera-off" size={26} color={colors.inkFaint} />
      <AppText testID="qr-scanner-unavailable" variant="caption" className="text-center">
        Le scan n’est pas disponible dans le navigateur. Saisissez le code à la main.
      </AppText>
      <Button
        testID="qr-scanner-close"
        label="Fermer"
        variant="secondary"
        size="sm"
        onPress={onClose}
      />
    </View>
  );
}

/** Quatre équerres roses : le cadre de visée. */
function Brackets() {
  const arm = 'absolute h-8 w-8 border-brand-500';
  return (
    <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
      <View className="h-44 w-44">
        <View className={`${arm} left-0 top-0 rounded-tl-card border-l-4 border-t-4`} />
        <View className={`${arm} right-0 top-0 rounded-tr-card border-r-4 border-t-4`} />
        <View className={`${arm} bottom-0 left-0 rounded-bl-card border-b-4 border-l-4`} />
        <View className={`${arm} bottom-0 right-0 rounded-br-card border-b-4 border-r-4`} />
      </View>
    </View>
  );
}

function NativeScanner({
  camera,
  onScan,
  onClose,
  title,
  testID,
}: QrScannerProps & { camera: CameraModule; testID: string }) {
  const colors = useColors();
  const { CameraView, useCameraPermissions } = camera;
  const [permission, requestPermission] = useCameraPermissions();

  // Première ouverture : on demande tout de suite, au lieu d'annoncer un refus qui n'a pas eu lieu.
  useEffect(() => {
    if (permission && permission.status === 'undetermined') void requestPermission();
  }, [permission, requestPermission]);
  const last = useRef<{ value: string; at: number } | null>(null);

  const handleScan = useCallback(
    ({ data }: { data: string }) => {
      if (!data) return;
      const now = Date.now();
      const prev = last.current;
      if (prev && prev.value === data && now - prev.at < DEBOUNCE_MS) return;
      last.current = { value: data, at: now };
      onScan(data);
    },
    [onScan],
  );

  // « Jamais demandée » n'est pas « refusée » : on demande, et on ne montre le refus qu'après.
  const denied = permission !== null && !permission.granted && permission.status !== 'undetermined';
  const granted = permission?.granted === true;

  return (
    <View
      testID={testID}
      className="h-[260px] w-full overflow-hidden rounded-card border border-line bg-surface-muted"
    >
      {granted ? (
        <>
          <CameraView
            testID="qr-scanner-camera"
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleScan}
          />
          <Brackets />
        </>
      ) : null}

      {denied ? (
        <View className="flex-1 items-center justify-center gap-3 px-6">
          <Feather name="camera-off" size={26} color={colors.inkFaint} />
          <AppText testID="qr-scanner-denied" variant="caption" className="text-center">
            L’accès à la caméra est refusé. Autorisez-le dans les réglages ou saisissez le code à la
            main.
          </AppText>
          <Button
            testID="qr-scanner-allow"
            label="Autoriser la caméra"
            size="sm"
            onPress={() => {
              void requestPermission();
            }}
          />
        </View>
      ) : null}

      {title ? (
        <View
          pointerEvents="none"
          className="absolute left-3 top-3 max-w-[70%] rounded-pill bg-surface-inverse/80 px-3 py-1.5"
        >
          <AppText className="font-sans-medium text-ink-inverse" style={{ fontSize: 12 }}>
            {title}
          </AppText>
        </View>
      ) : null}

      <Pressable
        testID="qr-scanner-close"
        accessibilityRole="button"
        accessibilityLabel="Fermer le scanner"
        onPress={onClose}
        hitSlop={8}
        className="absolute right-3 top-3 h-9 w-9 items-center justify-center rounded-pill bg-surface-inverse/80 active:opacity-80"
      >
        <Feather name="x" size={18} color={colors.inkInverse} />
      </Pressable>
    </View>
  );
}

/**
 * Lecteur de QR code, en vue caméra pleine largeur (~260 px de haut).
 *
 * Utilisé par l’app livreur pour valider une remise de colis. Sur le web — aperçu
 * navigateur seulement — la caméra n’est pas pilotée : on le dit et on laisse la
 * saisie manuelle au parent.
 */
export function QrScanner({ onScan, onClose, title, testID = 'qr-scanner' }: QrScannerProps) {
  const camera = Platform.OS === 'web' ? null : loadCamera();
  if (!camera) return <Unavailable testID={testID} onClose={onClose} />;
  return (
    <NativeScanner
      camera={camera}
      onScan={onScan}
      onClose={onClose}
      title={title}
      testID={testID}
    />
  );
}
