import { render, waitFor } from '@/shared/testing/render';

import { supabase } from '@/shared/lib/supabase';

import { resetPushModulesForTests } from '../lib/push';
import { routeForPush } from '../model/schema';
import { usePushStore } from '../model/store';
import { PushBridge } from '../ui/push-bridge';

/**
 * Les notifications (rapport d’avancement du 13/11/2026) : enregistrer le téléphone pour le compte
 * connecté, l’en retirer à la déconnexion, et ouvrir le bon écran au toucher — y compris quand la
 * notification lance l’app. Les modules natifs sont simulés.
 */
const mockServer = { configured: true };
jest.mock('@/shared/lib/env', () =>
  Object.defineProperty({ ...jest.requireActual('@/shared/lib/env') }, 'isSupabaseConfigured', {
    enumerable: true,
    get: () => mockServer.configured,
  }),
);
jest.mock('@/shared/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: 'p-1' } } } },
}));
jest.mock('expo-device', () => ({ isDevice: true }));

const ORDER = '55555555-5555-4555-8555-555555555555';
const tap = (data: unknown) => ({ notification: { request: { content: { data } } } });

const mockN = {
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  getExpoPushTokenAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
  getLastNotificationResponseAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  AndroidImportance: { HIGH: 4 },
};
jest.mock('expo-notifications', () => mockN);

const rpc = supabase.rpc as unknown as jest.Mock;

beforeEach(() => {
  resetPushModulesForTests();
  rpc.mockReset().mockResolvedValue({ error: null });
  mockServer.configured = true;
  mockN.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
  mockN.getExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[abc]' });
  mockN.getLastNotificationResponseAsync.mockResolvedValue(null);
  mockN.addNotificationResponseReceivedListener.mockReturnValue({ remove: jest.fn() });
  usePushStore.setState({ token: null, status: 'idle' });
});

describe('le toucher d’une notification', () => {
  it('ouvre la commande, la demande au support, ou les commandes reçues', () => {
    expect(routeForPush({ kind: 'order', id: ORDER })).toEqual({
      pathname: '/commande/[id]',
      params: { id: ORDER },
    });
    expect(routeForPush({ kind: 'support', id: ORDER })).toEqual({
      pathname: '/aide/[id]',
      params: { id: ORDER },
    });
    expect(routeForPush({ kind: 'merchant_order', id: ORDER })).toBe('/commandes');
    // Un commerce suivi publie une vente flash (0026) : l'offre en ligne, ou la vitrine d'une
    // Flash programmée.
    expect(routeForPush({ kind: 'offer', id: ORDER })).toEqual({
      pathname: '/produit/[id]',
      params: { id: ORDER },
    });
    expect(routeForPush({ kind: 'shop', id: ORDER })).toEqual({
      pathname: '/enseigne/[id]',
      params: { id: ORDER },
    });
  });

  it('une charge inattendue n’ouvre rien', () => {
    expect(routeForPush({ kind: 'order', id: '../../account' })).toBeNull();
    expect(routeForPush({ route: '/account' })).toBeNull();
    expect(routeForPush(null)).toBeNull();
  });
});

describe('enregistrer et retirer le téléphone', () => {
  it('enregistre le jeton pour le compte connecté, puis le retire à la déconnexion', async () => {
    await usePushStore.getState().register();
    expect(rpc).toHaveBeenCalledWith('register_push_token', {
      p_token: 'ExponentPushToken[abc]',
      p_platform: expect.stringMatching(/^(ios|android)$/),
    });
    expect(usePushStore.getState()).toMatchObject({
      token: 'ExponentPushToken[abc]',
      status: 'registered',
    });

    await usePushStore.getState().forget();
    expect(rpc).toHaveBeenLastCalledWith('unregister_push_token', {
      p_token: 'ExponentPushToken[abc]',
    });
    expect(usePushStore.getState().token).toBeNull();
  });

  it('autorisation refusée : rien n’est envoyé au serveur', async () => {
    mockN.getPermissionsAsync.mockResolvedValue({ status: 'denied' });
    mockN.requestPermissionsAsync.mockResolvedValue({ status: 'denied' });
    await usePushStore.getState().register();
    expect(usePushStore.getState().status).toBe('denied');
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('le pont des notifications', () => {
  it('la notification qui a lancé l’app attend que l’app soit prête, puis ouvre son écran', async () => {
    mockN.getLastNotificationResponseAsync.mockResolvedValue(tap({ kind: 'order', id: ORDER }));
    const onOpen = jest.fn();
    const { rerender } = render(<PushBridge ready={false} accountId={null} onOpen={onOpen} />);
    await waitFor(() => expect(mockN.getLastNotificationResponseAsync).toHaveBeenCalled());
    expect(onOpen).not.toHaveBeenCalled();

    rerender(<PushBridge ready accountId="u-1" onOpen={onOpen} />);
    await waitFor(() =>
      expect(onOpen).toHaveBeenCalledWith({ pathname: '/commande/[id]', params: { id: ORDER } }),
    );
    expect(onOpen).toHaveBeenCalledTimes(1);
    // Prête et connectée : le téléphone s'enregistre pour ce compte.
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith('register_push_token', expect.any(Object)),
    );
  });
});
