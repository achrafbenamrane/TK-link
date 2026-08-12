---
read-when: 'Vous ajoutez, remplacez ou vérifiez la provenance d’une photo d’offre'
owns: 'La procédure d’ajout d’un visuel produit et l’état de la dette photo'
---

# Les photos produit

**Toutes les offres du catalogue ont un visuel.** La dette est à zéro — mais le
mécanisme qui la mesure reste en place, et c’est lui qui compte.

## Ajouter ou remplacer une photo

1. Déposer l’image dans `assets/images/products/_incoming/`, **avec
   l’identifiant de l’offre dans le nom** — `d_casque.jpg`,
   `casque bluetooth d_casque.png`, peu importe le reste.
2. `npm run images:import` → redimensionnement (1200 px), compression JPEG,
   rangement sous le bon nom, et la liste de ce qui manque encore.
3. Ajouter l’entrée dans `PRODUCT_IMAGES`
   ([`product-images.ts`](../../src/features/shop/model/product-images.ts)).
   Cette table ne peut pas être générée : `require` n’accepte que des chemins
   littéraux, Metro résout les assets à la compilation.
4. Consigner la provenance dans
   [`CREDITS.md`](../../assets/images/products/CREDITS.md).
5. `npm test` — les tests d’intégrité vérifient que chaque offre a une photo
   **ou** est déclarée dans `AWAITING_PHOTO`, et refusent un identifiant
   orphelin.

Le script refuse ce qu’il ne sait pas lire plutôt que d’échouer au milieu du
lot : le format est vérifié sur les **octets**, pas sur l’extension — les
banques d’images servent régulièrement du WebP sous un nom en `.jpg`.

## Publier une offre sans photo

C’est possible, mais cela demande de l’écrire : l’identifiant doit entrer dans
`AWAITING_PHOTO`, sinon le test échoue. Une dette assumée par écrit vaut mieux
qu’une vignette emoji que personne ne remarque.

## D’où viennent les visuels actuels

Deux provenances, deux niveaux de risque — le détail est dans
[`CREDITS.md`](../../assets/images/products/CREDITS.md) :

| Lot                        | Source    | Licence              | Statut                           |
| -------------------------- | --------- | -------------------- | -------------------------------- |
| 8 visuels alimentaires     | Pinterest | droits de tiers      | ⚠️ à remplacer avant publication |
| 13 visuels (sorties, etc.) | Openverse | CC0 / domaine public | usage commercial autorisé        |

Les treize ont été **regardés un par un** avant d’être retenus : un résultat
étiqueté « cinema seats » s’est révélé être un mur de mousse acoustique, un
« bowling » un dessin vectoriel sur fond blanc. Un libellé de recherche n’est
pas une vérification.

## Où chercher, si vous en ajoutez

**Pinterest n’est pas une source** : c’est un moteur de re-publication, les
images y sont presque toutes sous droits d’autrui. Utile pour choisir un
cadrage, jamais comme fichier.

Sources utilisables : [Openverse](https://openverse.org) en filtrant sur CC0,
**Unsplash**, **Pexels**, **Pixabay**.

Cadrage **paysage**, sujet centré, fond simple : la carte recadre en ~1,5:1 et
superpose un compte à rebours en haut à gauche, un cœur en haut à droite, la
remise en bas à gauche et le stock en bas à droite. Les quatre coins sont donc
occupés — ce qui doit se voir va au centre.

### Cinéma : surtout pas d’affiches

Les quatre séances portent un film (titre, horaire, salle, version). **Aucune
affiche de distribution ne doit entrer dans l’app** : ces visuels sont
protégés, et une affiche dans une capture d’écran envoyée à un store est un
risque réel. Le _titre_, lui, est une information factuelle — un cinéma a le
droit d’annoncer ce qu’il projette.

Cherchez donc l’ambiance : salle, fauteuils, projecteur, enseigne.

## Et après

Ces visuels sont des **bouche-trous de démonstration**. En production, la photo
vient du commerçant — le CDC le prévoit explicitement (§3.2 et §18 : « ajouter
une image » dans le formulaire d’offre). Ce dossier se vide le jour où de vrais
commerçants publient.
