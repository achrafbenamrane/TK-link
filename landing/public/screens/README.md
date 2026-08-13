# Captures de l’application

Six fichiers, aux noms exacts attendus par `app/app-showcase.jsx` :

```
accueil.jpg    chasse.jpg    favoris.jpg
panier.jpg     commande.jpg  profil.jpg
```

Déposez-les ici, ou lancez `npm run screens:import` depuis `landing/` après les
avoir mis dans `public/screens/_incoming/` : le script redimensionne, compresse
et renomme dans l’ordre ci-dessus.

Tant qu’un fichier manque, le téléphone affiche un panneau portant le nom de
l’écran — jamais l’icône d’image cassée du navigateur.
