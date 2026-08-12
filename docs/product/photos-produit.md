---
read-when: 'Vous ajoutez ou remplacez une photo d’offre'
owns: 'Les onze visuels manquants : quoi chercher, comment nommer le fichier, comment l’intégrer'
---

# Les photos produit — ce qui manque, et comment l’ajouter

Onze offres n’ont pas encore de visuel. Elles s’affichent avec l’emoji du
commerçant sur fond teinté : lisible, mais ce n’est pas ce qui fait cliquer.
Le client l’a dit autrement — « le cœur de l’appli c’est les offres flash, faut
vraiment que ça se voie du 1er coup d’œil ».

## La marche à suivre

1. Trouver l’image (voir le tableau).
2. La déposer dans `assets/images/products/_incoming/` **avec l’identifiant
   dans le nom** — `d_casque.jpg`, `casque bluetooth d_casque.png`, peu importe
   le reste.
3. `npm run images:import` → redimensionnement, compression, rangement,
   et la liste de ce qui manque encore.
4. Ajouter l’entrée dans `PRODUCT_IMAGES` et retirer l’identifiant
   d’`AWAITING_PHOTO`
   ([`product-images.ts`](../../src/features/shop/model/product-images.ts)).
   Cette table ne peut pas être générée : `require` n’accepte que des chemins
   littéraux.
5. `npm test` — trois tests d’intégrité vérifient que chaque offre a une photo
   **ou** est déclarée comme dette, et refusent un identifiant orphelin.

## Ce qu’il faut chercher

Termes en anglais : les banques d’images en rendent dix fois plus. Cadrage
**paysage**, produit centré, fond simple — la carte recadre en 4:3 et superpose
un compte à rebours en haut à droite, un badge de remise en bas à gauche.

| Fichier          | L’offre                          | À chercher                                         |
| ---------------- | -------------------------------- | -------------------------------------------------- |
| `d_cinema.jpg`   | Place de cinéma · séance du soir | `empty cinema seats red velvet screen`             |
| `d_cine_duo.jpg` | Duo cinéma + boisson             | `movie popcorn and soda cup cinema`                |
| `d_bowling.jpg`  | Partie de bowling · 1 h          | `bowling lane pins neon alley`                     |
| `d_casque.jpg`   | Casque audio sans fil            | `wireless over ear headphones product shot`        |
| `d_tablette.jpg` | Tablette 10" reconditionnée      | `tablet on desk minimal flat lay`                  |
| `d_lampe.jpg`    | Lampe artisanale en grès         | `handmade stoneware ceramic table lamp warm light` |
| `d_veste.jpg`    | Veste en jean vintage            | `vintage denim jacket flat lay thrift`             |
| `d_soin.jpg`     | Coffret soin visage bio          | `organic skincare gift set bottles beige`          |
| `d_padel.jpg`    | Raquette de padel                | `padel racket and ball court`                      |
| `d_revision.jpg` | Révision + vidange               | `car engine oil change mechanic garage`            |
| `d_poterie.jpg`  | Atelier poterie · 2 h            | `pottery wheel hands clay workshop`                |

## Les droits, avant de télécharger

Pinterest n’est **pas** une source : c’est un moteur de re-publication, les
images y sont presque toutes sous droits d’autrui. Utile pour choisir un
cadrage, à ne pas utiliser comme fichier.

Pour une image réellement utilisable : **Unsplash**, **Pexels** ou
**Pixabay** (usage commercial autorisé, sans attribution obligatoire).

La bonne réponse à terme est différente : ces onze visuels sont des
**bouche-trous de démonstration**. En production, la photo vient du commerçant
— le CDC le prévoit explicitement (§3.2 et §18 : « ajouter une image » dans le
formulaire d’offre). Ce tableau disparaît le jour où de vrais commerçants
publient.
