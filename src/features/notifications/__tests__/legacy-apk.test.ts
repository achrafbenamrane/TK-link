import { getExpoPushToken, loadNotifications } from '../lib/push';

/**
 * L'APK installée chez les testeurs avant le 13/11/2026 n'a pas le module natif des notifications,
 * mais reçoit le nouveau code par mise à jour OTA. Le code doit alors se taire, pas planter.
 */
jest.mock('expo-notifications', () => {
  throw new Error('Cannot find native module ExpoPushTokenManager');
});

it('sans le module natif, les notifications se taisent au lieu de faire planter l’app', async () => {
  expect(loadNotifications()).toBeNull();
  expect(await getExpoPushToken()).toEqual({ ok: false, reason: 'unavailable' });
});
