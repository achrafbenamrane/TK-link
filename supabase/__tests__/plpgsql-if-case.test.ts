import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Garde-fou (14/11/2026, migration 0023) : dans la condition d'un `IF` / `ELSIF` PL/pgSQL, le
 * premier `THEN` rencontré clôt la condition — y compris celui d'un `CASE … THEN`. Le SQL Editor
 * répondait alors « syntax error at end of input » et toute la migration était refusée. Un `CASE`
 * dans une condition se met entre parenthèses, ou se calcule à part dans une variable.
 *
 * Les tests pgTAP ne tournent pas sur ce poste (pas de Docker) : ce garde lit les migrations.
 */
const DIR = join(__dirname, '..', 'migrations');

/** Retire commentaires `--` et chaînes '…' (en gardant la longueur des lignes pour les numéros). */
function strip(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, (m) => ' '.repeat(m.length))
    .replace(/'(?:[^']|'')*'/g, (m) => m.replace(/[^\n]/g, ' '));
}

/** Les `CASE` à hauteur zéro de parenthèses entre un `IF`/`ELSIF` et son `THEN`. */
export function casesInIfConditions(sql: string): number[] {
  const text = strip(sql);
  const lines: number[] = [];
  const opener = /\b(elsif|if)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = opener.exec(text))) {
    // `end if` ferme un bloc ; `if exists`, `if not found`… ouvrent une condition.
    if (/\bend\s*$/i.test(text.slice(Math.max(0, m.index - 10), m.index))) continue;
    let depth = 0;
    const word = /\(|\)|\b(then|case|end|if|loop)\b|;/gi;
    word.lastIndex = m.index + m[0].length;
    let t: RegExpExecArray | null;
    while ((t = word.exec(text))) {
      const tok = t[0].toLowerCase();
      if (tok === '(') depth += 1;
      else if (tok === ')') depth -= 1;
      else if (tok === ';') break;
      else if (depth === 0 && tok === 'then') break;
      else if (depth === 0 && tok === 'case') {
        lines.push(text.slice(0, t.index).split('\n').length);
        break;
      }
    }
  }
  return lines;
}

it('repère un CASE nu dans une condition, pas un CASE entre parenthèses', () => {
  const bad = 'begin\n  if x > case when a then 1 else 2 end then\n    null;\n  end if;\nend;';
  const good = 'begin\n  if x > (case when a then 1 else 2 end) then\n    null;\n  end if;\nend;';
  expect(casesInIfConditions(bad)).toEqual([2]);
  expect(casesInIfConditions(good)).toEqual([]);
  // La condition refusée par le SQL Editor (0023, première version), sur trois lignes.
  const refused = [
    '    if v_line.qty is null or v_line.qty < greatest(1, v_offer.min_qty)',
    "       or v_line.qty > case when v_audience = 'commercants' then 999 else 99 end then",
    "      raise exception 'invalid_items' using errcode = '22023';",
    '    end if;',
  ].join('\n');
  expect(casesInIfConditions(refused)).toEqual([2]);
  // Un CASE dans un INSERT ou une affectation n'est pas une condition.
  expect(
    casesInIfConditions(
      "v := case when a then 1 end;\ninsert into t values (case when b then 'x' end);",
    ),
  ).toEqual([]);
});

it.each(readdirSync(DIR).filter((f) => f.endsWith('.sql')))(
  '%s : aucun CASE nu dans une condition IF',
  (file) => {
    expect(casesInIfConditions(readFileSync(join(DIR, file), 'utf8'))).toEqual([]);
  },
);
