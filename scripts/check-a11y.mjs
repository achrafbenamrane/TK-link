/**
 * Garde-fou d'accessibilité : chaque `<Pressable>` des écrans doit avoir un `accessibilityRole`.
 *
 * Un bouton sans rôle n'est pas annoncé comme un bouton par TalkBack ni par VoiceOver : pour une
 * personne qui ne voit pas l'écran, il n'existe pas. Le script échoue dès qu'un bouton n'en a pas.
 *
 * Usage : node scripts/check-a11y.mjs  (fait partie de `npm run verify`)
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(process.cwd(), 'src');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory())
      return entry.name === '__tests__' ? [] : walk(path.join(dir, entry.name));
    return entry.name.endsWith('.tsx') ? [path.join(dir, entry.name)] : [];
  });
}

const missing = [];
for (const file of walk(ROOT)) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/<Pressable\b[\s\S]*?(?<!=)>/g)) {
    if (/accessibilityRole|\brole=/.test(match[0])) continue;
    const line = source.slice(0, match.index).split('\n').length;
    missing.push(`${path.relative(process.cwd(), file).split(path.sep).join('/')}:${line}`);
  }
}

if (missing.length > 0) {
  console.error(`check-a11y ✗ ${missing.length} <Pressable> sans accessibilityRole :`);
  for (const m of missing) console.error(`  ${m}`);
  process.exit(1);
}
console.log('check-a11y ✓ chaque <Pressable> a un accessibilityRole');
