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
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
let Jimp;
try {
  Jimp = require('jimp-compact');
} catch {
  console.error(
    '\n✗ « jimp-compact » est absent.\n' +
      '  Il ne sert qu\u2019à cette opération : `npm i -D jimp-compact` dans landing/.\n',
  );
  process.exit(1);
}

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

const files = readdirSync(IN)
  .filter((f) => /\.(jpe?g|png)$/i.test(f))
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
