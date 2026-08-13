#!/usr/bin/env node
/**
 * Intègre les captures d'écran de l'application déposées dans
 * `public/screens/_incoming/`.
 *
 * Les captures viennent d'un téléphone : elles pèsent 1 à 3 Mo chacune, en PNG,
 * pour un affichage de 300 px de large. Livrées telles quelles, six d'entre
 * elles suffiraient à rendre la page plus lourde que tout le reste du site.
 *
 *   1. déposer les six captures dans landing/public/screens/_incoming/
 *      (l'ordre alphabétique décide de l'affectation — préfixez 1_, 2_, …)
 *   2. npm run screens:import
 */
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);

/**
 * `jimp-compact` est installé à la RACINE du dépôt, pas dans `landing/`.
 * On tente les deux plutôt que d'imposer une seconde installation : le paquet
 * ne sert qu'à cette opération, une fois de temps en temps.
 */
function loadJimp() {
  for (const id of [
    'jimp-compact',
    path.join(process.cwd(), '..', 'node_modules', 'jimp-compact'),
  ]) {
    try {
      return require(id);
    } catch {
      /* on essaie le suivant */
    }
  }
  console.error(
    '\n✗ « jimp-compact » est introuvable, ni ici ni à la racine du dépôt.\n' +
      '  Lancez `npm install` à la racine, ou `npm i -D jimp-compact` ici.\n',
  );
  process.exit(1);
}
const Jimp = loadJimp();

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'public', 'screens');
const IN = path.join(OUT, '_incoming');

/** Les noms attendus par `app/app-showcase.jsx`, dans l'ordre d'affichage. */
const NAMES = ['accueil', 'chasse', 'favoris', 'panier', 'commande', 'profil'];

/** 900 px : deux fois la largeur affichée, pour les écrans à forte densité. */
const WIDTH = 900;
const QUALITY = 82;

if (!existsSync(IN)) {
  mkdirSync(IN, { recursive: true });
  console.log(`Dossier créé : ${path.relative(ROOT, IN)}`);
}

/**
 * Le format RÉEL du fichier, lu dans ses premiers octets.
 *
 * Une capture enregistrée depuis un navigateur arrive souvent SANS extension.
 * Filtrer sur le nom ne trouvait alors rien, et le script annonçait « rien à
 * intégrer » alors que les six fichiers étaient là.
 */
function readable(file) {
  const head = readFileSync(file).subarray(0, 8);
  if (head[0] === 0xff && head[1] === 0xd8) return true; // JPEG
  if (head[0] === 0x89 && head[1] === 0x50) return true; // PNG
  return false;
}

const files = readdirSync(IN)
  .filter((f) => f !== '.gitkeep' && readable(path.join(IN, f)))
  .sort();

if (files.length === 0) {
  console.log(`Rien à intégrer. Déposez les captures dans ${path.relative(ROOT, IN)}.`);
  process.exit(0);
}

if (files.length !== NAMES.length) {
  console.log(
    `⚠ ${files.length} fichier(s) pour ${NAMES.length} écrans attendus — ` +
      `les premiers seront affectés dans l'ordre : ${NAMES.join(', ')}.`,
  );
}

for (let i = 0; i < Math.min(files.length, NAMES.length); i++) {
  const source = path.join(IN, files[i]);
  const target = path.join(OUT, `${NAMES[i]}.jpg`);

  const img = await Jimp.read(source);
  if (img.bitmap.width > WIDTH) img.resize(WIDTH, Jimp.AUTO);
  img.quality(QUALITY);
  await img.writeAsync(target);

  const kb = Math.round(statSync(target).size / 1024);
  console.log(`  ✓ ${NAMES[i]}.jpg — ${img.bitmap.width}px, ${kb} Ko  (${files[i]})`);
  unlinkSync(source);
}

console.log('\nRelancez `npm run build` pour vérifier le rendu.');
