import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { haptic } from '../haptics';

describe('haptic', () => {
  beforeEach(() => jest.clearAllMocks());

  it('une réussite et une erreur vibrent de façon différente', () => {
    haptic.success();
    expect(Haptics.notificationAsync).toHaveBeenLastCalledWith('success');
    haptic.error();
    expect(Haptics.notificationAsync).toHaveBeenLastCalledWith('error');
    haptic.tap();
    expect(Haptics.impactAsync).toHaveBeenLastCalledWith('light');
  });

  it('ne fait rien sur le web', () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    haptic.success();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  it('un moteur de vibration en panne ne casse jamais le geste', async () => {
    (Haptics.notificationAsync as jest.Mock).mockRejectedValueOnce(new Error('pas de moteur'));
    expect(() => haptic.success()).not.toThrow();
    await Promise.resolve();
  });
});
