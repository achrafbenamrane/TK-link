import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Garde-fou (relecture du 13/11/2026) : une fonction Edge appelée par l'APP passe par `serve` de
 * `_shared/http.ts`, qui transforme toute exception imprévue en réponse JSON `server_error` avec les
 * en-têtes CORS. Appelée directement, `Deno.serve` rend un 500 en texte brut que l'app lit comme
 * « hors ligne ». Seuls les webhooks (Stripe, Uber, base de données, RevenueCat) gardent `Deno.serve`.
 */
const ROOT = join(__dirname, '..', 'functions');
const WEBHOOKS = new Set([
  'stripe-webhook',
  'uber-webhook',
  'push-events',
  'order-refund',
  'revenuecat-webhook',
]);

const appCalled = readdirSync(ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('_') && !WEBHOOKS.has(d.name))
  .map((d) => d.name)
  .filter((name) => existsSync(join(ROOT, name, 'index.ts')));

it('trouve les fonctions appelées par l’app', () => {
  expect(appCalled.length).toBeGreaterThanOrEqual(11);
});

it.each(appCalled)('%s passe par le point d’entrée commun', (name) => {
  const source = readFileSync(join(ROOT, name, 'index.ts'), 'utf8');
  expect(source).not.toMatch(/Deno\.serve\(/);
  expect(source).toMatch(/^serve\(/m);
  expect(source).toMatch(/import \{[^}]*\bserve\b[^}]*\} from '\.\.\/_shared\/http\.ts';/);
});
