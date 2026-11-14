import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Les tests pgTAP se mettent dans la peau d'un compte par `set local request.jwt.claims to '{…}'`.
 * Le 14/11/2026, trois de ces lignes (0026) sont parties SANS leurs guillemets — `'{sub:…,role:…}'`,
 * perdus par `node -e` sous PowerShell : `auth.uid()` lit ce texte comme du JSON, la conversion
 * échoue et toute la suite s'arrête. Faute de Docker sur ce poste, `supabase test db` ne l'aurait pas
 * montré. Ce test-ci tourne partout : chaque valeur doit être un objet JSON lisible.
 */
const DIR = join(__dirname, '..', 'tests', 'database');
const files = readdirSync(DIR).filter((f) => f.endsWith('.sql'));

it.each(files)('%s : des « claims » en JSON valide', (file) => {
  const bad = readFileSync(join(DIR, file), 'utf8')
    .split('\n')
    .map((line, i) => ({ line, n: i + 1 }))
    .flatMap(({ line, n }) => {
      const m = /request\.jwt\.claims\s+to\s+'([^']*)'/.exec(line);
      if (!m) return [];
      try {
        const value: unknown = JSON.parse(m[1]!);
        return value && typeof value === 'object' && !Array.isArray(value) ? [] : [`${n}: ${m[1]}`];
      } catch {
        return [`${n}: ${m[1]}`];
      }
    });
  expect(bad).toEqual([]);
});
