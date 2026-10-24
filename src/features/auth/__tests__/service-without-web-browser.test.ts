import { Platform } from 'react-native';

import { supabase } from '@/shared/lib/supabase';

import { signInWithAppleWeb } from '../model/service';

/**
 * Apple sur Android s'appuie sur `expo-web-browser`, chargé à la demande. Une build native faite
 * avant l'ajout du module ne l'a pas : son chargement lève (« Cannot find native module »). Ce cas
 * doit rester un refus classé, « indisponible », jamais un plantage — et rien ne part vers Supabase.
 *
 * Fichier à part : le module y est absent pour tout le fichier, alors que `service.test.ts` le simule.
 */
jest.mock('@/shared/lib/supabase', () => ({
  supabase: { auth: { signInWithOAuth: jest.fn() } },
}));

jest.mock('expo-web-browser', () => {
  throw new Error('module natif absent de cette build');
});

const signInWithOAuth = supabase.auth.signInWithOAuth as unknown as jest.Mock;

afterEach(() => jest.restoreAllMocks());

it('sans le module natif du navigateur, Apple par la page web est indisponible', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  expect(await signInWithAppleWeb()).toEqual({ ok: false, code: 'unavailable' });
  expect(signInWithOAuth).not.toHaveBeenCalled();
});
