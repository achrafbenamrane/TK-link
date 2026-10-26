import { offersDemoShortcuts, parseEnv } from '@/shared/lib/env';

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

/**
 * Dans une build de production (APK, mise à jour EAS), Expo ne remplace QUE les lectures écrites en
 * toutes lettres, `process.env.EXPO_PUBLIC_X`. Lire `process.env` d'un bloc marche en développement
 * et rend un objet VIDE dans l'APK : l'app y tournait en démonstration, sans Supabase ni Google.
 */
describe('lecture des variables', () => {
  // why: les types de Node ne sont pas chargés dans l'app ; Jest tourne depuis la racine du dépôt.
  const { readFileSync } = jest.requireActual<{
    readFileSync: (path: string, enc: 'utf8') => string;
  }>('fs');
  const source = readFileSync('src/shared/lib/env.ts', 'utf8');

  it('lit chaque variable du schéma en toutes lettres', () => {
    const keys = [...source.matchAll(/^\s+(EXPO_PUBLIC_[A-Z_]+):/gm)].map((m) => m[1]);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of new Set(keys)) expect(source).toContain(`process.env.${key}`);
  });

  it('ne passe jamais `process.env` entier', () => {
    expect(source).not.toMatch(/process\.env(?!\.EXPO_PUBLIC_)\s*(as|[,)])/);
  });
});

describe('raccourcis de démonstration', () => {
  it('seulement sans vrai serveur : avec Supabase, « Démo » ouvrait un faux compte local', () => {
    expect(offersDemoShortcuts({ demoBuild: true, serverConfigured: false })).toBe(true);
    expect(offersDemoShortcuts({ demoBuild: true, serverConfigured: true })).toBe(false);
    expect(offersDemoShortcuts({ demoBuild: false, serverConfigured: false })).toBe(false);
  });
});
