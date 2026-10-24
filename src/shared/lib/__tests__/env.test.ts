import { parseEnv } from '@/shared/lib/env';

describe('parseEnv', () => {
  it('applies safe defaults for local development', () => {
    const env = parseEnv({});
    expect(env.EXPO_PUBLIC_API_URL).toBe('https://api.example.com');
    expect(env.EXPO_PUBLIC_APP_ENV).toBe('development');
  });

  it('accepts a valid configuration', () => {
    const env = parseEnv({
      EXPO_PUBLIC_API_URL: 'https://api.yourcompany.com',
      EXPO_PUBLIC_APP_ENV: 'production',
    });
    expect(env.EXPO_PUBLIC_APP_ENV).toBe('production');
  });

  it('laisse Google débranché et le téléphone proposé par défaut', () => {
    const env = parseEnv({});
    expect(env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID).toBe('');
    expect(env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID).toBe('');
    expect(env.EXPO_PUBLIC_AUTH_PHONE).toBe('on');
  });

  it('accepte des identifiants Google bien formés, refuse les autres', () => {
    const ok = parseEnv({
      EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: '1234567890-abcdef123.apps.googleusercontent.com',
    });
    expect(ok.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID).toMatch(/googleusercontent/);
    expect(() => parseEnv({ EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: 'mon-identifiant' })).toThrow(
      /GOOGLE_WEB_CLIENT_ID/,
    );
    expect(() => parseEnv({ EXPO_PUBLIC_AUTH_PHONE: 'peut-etre' })).toThrow(/AUTH_PHONE/);
  });

  it('fails fast with a readable message on malformed values', () => {
    expect(() => parseEnv({ EXPO_PUBLIC_API_URL: 'not-a-url' })).toThrow(/EXPO_PUBLIC_API_URL/);
  });
});
