# Dépôt des photos produit

Déposez ici les images à intégrer, puis lancez `npm run images:import`.

Le nom du fichier doit **contenir l identifiant de l offre** — le reste est
libre :

```
d_casque.png
casque audio d_casque.jpg
d_cinema (1).webp
```

Le script redimensionne (1200 px de large), recompresse en JPEG, range sous le
bon nom dans le dossier parent, vide ce dossier, et dit ce qui manque encore.

Ce dossier est ignoré par git : seules les images traitées sont versionnées.
