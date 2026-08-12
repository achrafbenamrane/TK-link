#!/usr/bin/env node
/**
 * Intègre les photos produit déposées dans `assets/images/products/_incoming/`.
 *
 * Le geste manuel qu'on répétait : redimensionner, recompresser, renommer avec
 * l'identifiant exact de l'offre, vérifier qu'on n'a rien oublié. Quatre
 * occasions de se tromper, dont une invisible — un fichier mal nommé ne
 * s'affiche jamais, sans que rien ne le signale.
 *
 * Utilisation :
 *   1. déposer les images dans assets/images/products/_incoming/
 *      (le nom doit contenir l'identifiant de l'offre : « d_casque.png »,
 *      « casque audio d_casque.jpg », « d_casque (1).webp »… peu importe)
 *   2. npm run images:import
 *
 * Le script redimensionne, recompresse en JPEG, range sous le bon nom, puis
 * DIT ce qui manque encore. Il ne touche jamais à une photo déjà en place sans
 * le dire.
 */
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const Jimp = require('jimp-compact');

const ROOT = process.cwd();
const PRODUCTS = path.join(ROOT, 'assets/images/products');
const INCOMING = path.join(PRODUCTS, '_incoming');

/** Largeur cible : au-delà, on paie du poids pour des pixels jamais affichés. */
const WIDTH = 1200;
const QUALITY = 78;

/** Les identifiants d'offres, lus dans le catalogue — jamais recopiés à la main. */
function dealIds() {
  const src = readFileSync(path.join(ROOT, 'src/features/shop/model/catalog.ts'), 'utf8');
  return [...src.matchAll(/id: '(d_[a-z_]+)'/g)].map((m) => m[1]);
}

/** Les offres qui attendent encore une photo. */
function awaiting() {
  const src = readFileSync(path.join(ROOT, 'src/features/shop/model/product-images.ts'), 'utf8');
  const block = src.slice(
    src.indexOf('AWAITING_PHOTO'),
    src.indexOf(']', src.indexOf('AWAITING_PHOTO')),
  );
  return [...block.matchAll(/'(d_[a-z_]+)'/g)].map((m) => m[1]);
}

const ids = dealIds();
if (!existsSync(INCOMING)) {
  mkdirSync(INCOMING, { recursive: true });
  console.log(`Dossier créé : ${path.relative(ROOT, INCOMING)}`);
}

const files = readdirSync(INCOMING).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
let done = 0;

for (const file of files) {
  // On repère l'identifiant LE PLUS LONG contenu dans le nom : « d_cine_duo »
  // doit gagner contre « d_cinema » sur « d_cine_duo.png ».
  const match = ids
    .filter((id) => file.toLowerCase().includes(id))
    .sort((a, b) => b.length - a.length)[0];

  if (!match) {
    console.log(`  ⚠ ignoré — aucun identifiant d'offre dans « ${file} »`);
    continue;
  }

  const target = path.join(PRODUCTS, `${match}.jpg`);
  const existed = existsSync(target);

  const img = await Jimp.read(path.join(INCOMING, file));
  if (img.bitmap.width > WIDTH) img.resize(WIDTH, Jimp.AUTO);
  img.quality(QUALITY);
  await img.writeAsync(target);

  const kb = Math.round(statSync(target).size / 1024);
  console.log(`  ✓ ${match}.jpg — ${img.bitmap.width}px, ${kb} Ko${existed ? ' (remplacée)' : ''}`);
  unlinkSync(path.join(INCOMING, file));
  done++;
}

const missing = awaiting().filter((id) => !existsSync(path.join(PRODUCTS, `${id}.jpg`)));

console.log(`\n${done} image(s) intégrée(s).`);
if (missing.length === 0) {
  console.log('Plus aucune photo manquante — videz AWAITING_PHOTO dans product-images.ts.');
} else {
  console.log(`Il manque encore ${missing.length} photo(s) : ${missing.join(', ')}`);
}
console.log(
  '\nRappel : ajoutez les nouvelles images à PRODUCT_IMAGES et retirez leur\n' +
    "identifiant d'AWAITING_PHOTO — `require` n'accepte que des chemins\n" +
    'littéraux, cette table ne peut pas être générée.',
);
