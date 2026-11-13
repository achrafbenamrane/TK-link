import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { logger } from '@/shared/lib/logger';

/**
 * Le module natif des notifications, chargé À LA DEMANDE et sans jamais planter.
 *
 * `expo-notifications` est un module natif ajouté le 13/11/2026. L'APK déjà installée chez les
 * testeurs ne le contient pas, et elle doit pourtant recevoir par mise à jour OTA le paiement, les
 * commandes et le support (même `runtimeVersion`). Un `import` en tête de fichier ferait planter
 * l'app au démarrage sur cette APK ; un `require` gardé rend `null`, et les notifications se taisent
 * jusqu'à la prochaine APK. Sur le web (aperçu), pas de notifications non plus.
 */
type NotificationsModule = typeof import('expo-notifications');
type DeviceModule = typeof import('expo-device');

let notifications: NotificationsModule | null | undefined;
let device: DeviceModule | null | undefined;

export function loadNotifications(): NotificationsModule | null {
  if (notifications !== undefined) return notifications;
  if (Platform.OS === 'web') return (notifications = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- why: module natif absent des anciennes APK, chargé sous garde
    notifications = require('expo-notifications') as NotificationsModule;
  } catch (err) {
    logger.warn('push: module natif absent (APK antérieure au 13/11/2026)', { err });
    notifications = null;
  }
  return notifications;
}

function loadDevice(): DeviceModule | null {
  if (device !== undefined) return device;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- why: module natif absent des anciennes APK, chargé sous garde
    device = require('expo-device') as DeviceModule;
  } catch {
    device = null;
  }
  return device;
}

/** Pour les tests : oublier les modules chargés. */
export function resetPushModulesForTests(): void {
  notifications = undefined;
  device = undefined;
}

export type TokenResult =
  | { ok: true; token: string; platform: 'ios' | 'android' }
  | { ok: false; reason: 'denied' | 'unavailable' | 'error' };

/**
 * Demande l’autorisation et rend le jeton Expo de ce téléphone. Ne lève jamais.
 *
 * `unavailable` : module absent (ancienne APK, web), simulateur, ou projet EAS inconnu.
 */
export async function getExpoPushToken(): Promise<TokenResult> {
  const N = loadNotifications();
  const D = loadDevice();
  if (!N || !D || !D.isDevice) return { ok: false, reason: 'unavailable' };
  const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)
    ?.eas?.projectId;
  if (!projectId) return { ok: false, reason: 'unavailable' };

  try {
    let { status } = await N.getPermissionsAsync();
    if (status !== 'granted') status = (await N.requestPermissionsAsync()).status;
    if (status !== 'granted') return { ok: false, reason: 'denied' };

    // Android : un canal est exigé avant toute notification. « Commandes » : ce qui arrive est
    // toujours une commande ou une réponse du support, jamais de la publicité.
    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync('default', {
        name: 'Commandes et support',
        importance: N.AndroidImportance.HIGH,
      });
    }

    const { data } = await N.getExpoPushTokenAsync({ projectId });
    return { ok: true, token: data, platform: Platform.OS === 'ios' ? 'ios' : 'android' };
  } catch (err) {
    logger.warn('push: jeton indisponible', { err });
    return { ok: false, reason: 'error' };
  }
}

/** Une notification reçue app ouverte s’affiche quand même (bannière + son). */
export function configureForegroundBehavior(): void {
  loadNotifications()?.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}
