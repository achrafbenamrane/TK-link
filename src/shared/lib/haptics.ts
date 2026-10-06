import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * LE RETOUR TACTILE — une vibration légère aux moments qui comptent : une identité validée, une
 * livraison confirmée, une commande payée, une erreur. Jamais pour un simple appui : trop de
 * vibrations ne disent plus rien.
 *
 * Silencieux sur le web et partout où le téléphone n'a pas de moteur de vibration : l'appelant
 * n'a rien à vérifier, et un échec ne casse jamais le geste qui l'a déclenché.
 */
function run(effect: () => Promise<void>): void {
  if (Platform.OS === 'web') return;
  void effect().catch(() => undefined);
}

export const haptic = {
  /** Une réussite : empreinte validée, livraison confirmée, commande payée. */
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Un échec : empreinte non reconnue, code refusé. */
  error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  /** Un choix franc : un interrupteur, un onglet de filtre. */
  tap: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
} as const;
