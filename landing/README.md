# TK LINK — Site (Next.js)

Site vitrine de TK LINK, porté en **Next.js (App Router)**. Charte du client (noir, blanc, rose
#FF1478, bleu #00B2FF) ; Manrope pour le texte (celle de l'app), Big Shoulders Display pour les
titres et les prix (auto-hébergée dans `public/fonts/`, licence OFL).

## Stack

- Next.js 15 (App Router), React 19
- CSS sans dépendance : `app/globals.css` (base commune), `app/vitrine.css` (page d'accueil)
- 3D : rendue dans **Blender** par script, servie en images (aucun moteur 3D dans la page)

## Démarrer

```bash
cd landing
npm install
npm run dev
```

Ouvrez http://localhost:3000

## Build de production

```bash
npm run build
npm start
```

Pour vérifier un build sans casser le serveur de dev : `NEXT_DIST_DIR=.next-verify npx next build`.

## Structure

```
app/
  layout.jsx              # <html>, polices, metadata
  page.jsx                # la page d'accueil (server component)
  vitrine.css             # son système : couleurs, typo, espaces, mouvement
  _vitrine/live-offer.jsx # l'offre du héros, compte à rebours réel
  _vitrine/tag-spin.jsx   # « Comment ça marche » : l'étiquette tourne au défilement
  _vitrine/motion.jsx     # entrée du héros, apparitions, chiffres, parallaxe
  globals.css             # base commune à toutes les pages
blender/
  etiquette.py            # la scène 3D, construite entièrement par script
  etiquette.blend         # la même scène, à ouvrir dans Blender pour la retoucher
  qr.json, fonts/         # le QR du dos, les polices des textes en relief
public/3d/                # les rendus servis : etiquette.webp, tour/00…29.webp
```

## L'étiquette 3D

Une étiquette de prix rose fluo (« −59 % » devant, le QR du code de retrait derrière), éclairée
comme en fin de journée : soleil couchant à gauche, contre-jour bleu de la charte à droite. Pour la
refaire (Blender 5.2, GPU détecté tout seul, ~15 s par image) :

```bash
B="/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"
"$B" -b --factory-startup -P blender/etiquette.py -- --shot hero               # etiquette.webp
"$B" -b --factory-startup -P blender/etiquette.py -- --shot back               # etiquette-dos.webp (non servie)
"$B" -b --factory-startup -P blender/etiquette.py -- --shot spin --blend       # tour/ + .blend
```

Options : `--samples N` (256 pour les vues fixes, 96 pour le tour), `--png` (une copie PNG pour
relire), `--out DOSSIER`. La remise affichée sur l'étiquette doit rester celle de l'offre du héros
(`_vitrine/live-offer.jsx`).

## Back-offices

`/admin` (Super Admin), `/pro` (commerçant) et `/grossiste` : données simulées, protégées par
`TKLINK_PRO_PASSWORD` (voir `DEPLOY.md`). Plusieurs fichiers de `app/pro/` sont des **miroirs** de
l'app mobile (réglages, fidélité, vitrine, avis, statuts de commande) : le test
`landing/__tests__/backoffice-mirror.test.ts` échoue si une copie dérive.

> Projet autonome (son propre `package.json`). Lancez les commandes npm depuis
> le dossier `landing/`, pas depuis la racine du repo Expo.
