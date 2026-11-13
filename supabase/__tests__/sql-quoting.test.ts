import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Les blocs SQL entre dollars s’écrivent `$$ … $$`. Le 11/11/2026, quinze tests pgTAP sont partis
 * avec un `$` seul : SQL invalide, donc tests jamais exécutés — et rien ne l’a vu, faute de Docker
 * sur ce poste pour lancer `supabase test db`. La cause : un script Node qui insérait le SQL avec
 * `String.replace(motif, sql)`, où `$$` dans la chaîne de remplacement veut dire « un `$` ».
 * Pour insérer du SQL par script : concaténer (`slice`), ou passer une FONCTION à `replace`.
 * Ce test-ci tourne partout : il refuse un `$` isolé qui ouvre ou ferme un bloc.
 */
const ROOT = join(__dirname, '..');
const files = [
  ...readdirSync(join(ROOT, 'migrations')).map((f) => join(ROOT, 'migrations', f)),
  ...readdirSync(join(ROOT, 'tests', 'database')).map((f) => join(ROOT, 'tests', 'database', f)),
].filter((f) => f.endsWith('.sql'));

it.each(files.map((f) => [f.slice(ROOT.length + 1), f]))(
  '%s : pas de « $ » seul',
  (_name, file) => {
    const lone = readFileSync(file, 'utf8')
      .split('\n')
      .map((line, i) => ({ line, n: i + 1 }))
      .filter(({ line }) => !line.trimStart().startsWith('--'))
      // Un `$` qui n'est ni doublé, ni un paramètre (`$1`), ni une étiquette (`$body$`).
      .filter(({ line }) => /(^|[\s(,])\$(?![$\w])/.test(line.replace(/\$\$/g, '')))
      .map(({ n, line }) => `${n}: ${line.trim()}`);
    expect(lone).toEqual([]);
  },
);
