---
read-when: 'Avant de dessiner ou de modifier un écran : ce sont les maquettes du client, et les arbitrages qui les rendent compatibles avec le CDC'
owns: 'L’inventaire des maquettes reçues le 03/10/2026, la charte graphique, et les quatre arbitrages du même jour'
---

# Les maquettes du client — 03/10/2026

> **D’où ça vient.** Farid a remis le 03/10/2026, avec le [CDC V1.1](../../product/cdc-v1.1.md),
> une série de maquettes : les quatre schémas de parcours (déjà reçus le 16/08, voir
> [parcours-clients.md](../../product/parcours-clients.md)), des écrans en mode Nuit et Jour pour
> le commerçant et le consommateur, une charte graphique, et l’écran de remise au livreur.
>
> **Règle de priorité :** là où une maquette contredit le CDC, **le CDC gagne** — consigne du
> 03/10/2026, « respecter exactement ce dont le client a besoin ». Chaque écart est consigné
> ci-dessous, avec l’arbitrage retenu.

## Ce qui a été reçu

| Rôle        | Fichier                                                                                        | Contenu                                                             |
| ----------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Commerçant  | [01-process-commercant.jpg](commercant/01-process-commercant.jpg)                              | Parcours en 12 étapes et statuts                                    |
| Commerçant  | [02-inscription-commercant.jpg](commercant/02-inscription-commercant.jpg)                      | Inscription, onglets Commerçant / Grossiste, Nuit et Jour           |
| Commerçant  | [03-accueil-commercant.jpg](commercant/03-accueil-commercant.jpg)                              | Tableau de bord, Nuit et Jour                                       |
| Utilisateur | [01-process-utilisateur.jpg](utilisateur/01-process-utilisateur.jpg)                           | Parcours en 12 étapes et statuts                                    |
| Utilisateur | [02-inscription-utilisateur.jpg](utilisateur/02-inscription-utilisateur.jpg)                   | Inscription, Nuit et Jour                                           |
| Utilisateur | [03-offre-flash-a.jpg](utilisateur/03-offre-flash-a.jpg)                                       | Direction A : la carte « OFFRE FLASH » seule                        |
| Utilisateur | [04-accueil-a.jpg](utilisateur/04-accueil-a.jpg)                                               | Direction A : accueil avec recherche et catégories                  |
| Utilisateur | [05-charte-graphique-a.jpg](utilisateur/05-charte-graphique-a.jpg)                             | **Charte graphique** : logo, couleurs, usages, principes            |
| Utilisateur | [06-accueil-b-liste-carte.jpg](utilisateur/06-accueil-b-liste-carte.jpg)                       | Direction B : accueil, bascule Liste / Carte, Nuit et Jour          |
| Utilisateur | [07-accueil-b-variante.jpg](utilisateur/07-accueil-b-variante.jpg)                             | Direction B : variante de l’accueil                                 |
| Utilisateur | [08-fidelite-commerce-b.jpg](utilisateur/08-fidelite-commerce-b.jpg)                           | Direction B : fidélité chez un commerce, Nuit et Jour               |
| Grossiste   | [01-process-grossiste.jpg](grossiste/01-process-grossiste.jpg)                                 | Parcours en 12 étapes et statuts — **aucun écran**                  |
| Livreur     | [01-process-livreur.jpg](livreur/01-process-livreur.jpg)                                       | Parcours en 12 étapes et statuts de mission                         |
| Livreur     | [02-validation-livreur-cote-commercant.jpg](livreur/02-validation-livreur-cote-commercant.jpg) | Remise du colis au livreur, **vue depuis l’appareil du commerçant** |

## Les quatre arbitrages du 03/10/2026

Tranchés par Achraf le jour de la réception, sur proposition argumentée :

1. **Consommateur : écrans de la direction B, couleurs et logo de la direction A.** La direction B
   couvre mieux le §3.1 du CDC (bascule Liste / Carte, filtres, zone « Ça part maintenant », onglet
   Commandes) et appartient à la même famille que les écrans commerçant, inscription et livreur. La
   charte A fournit l’identité officielle. **« La Chasse » disparaît** : la barre compte quatre
   onglets — **Accueil · Favoris · Commandes · Compte**.
2. **L’app commerçant s’ouvre sur les commandes en cours**, comme l’exige la V1.1 (un employé doit
   pouvoir marquer une commande prête sans voir le chiffre d’affaires). Le tableau de bord de la
   maquette reste à un geste, dans l’onglet Accueil.
3. **Grossiste : inscription dans l’app** (onglet « Grossiste » de la maquette d’inscription),
   **outils sur le portail web** `/grossiste`, déjà construit.
4. **« Sur place » est retiré** du choix des modes de remise : le CDC ne connaît que Touch & Collect
   et la livraison.

## Les écarts tranchés par le CDC

| Maquette                                            | CDC                                                          | Ce qu’on construit                             |
| --------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------- |
| B : onglet central « La Chasse »                    | Absent de la V1.0 et de la V1.1                              | Barre à quatre onglets                         |
| B : « Transférer des points », « Transfert envoyé » | V1.1 : **points bruts jamais transférables**                 | Pas de transfert ; partage d’une récompense    |
| A : solde global, « Niveau Or → Diamant »           | Points **liés à chaque commerce**, pas de monnaie TK Link    | Fidélité affichée commerce par commerce        |
| A : grande carte sans commerçant ni mode de remise  | §3.1 : la carte affiche **commerçant** et **mode de remise** | Les deux ajoutés, discrètement                 |
| Commerçant : aucun accès B2B visible                | V1.1 : offres B2B via **l’onglet grossiste**                 | Accès « Grossistes » ajouté au tableau de bord |
| Commerçant : pas d’onglet Versements                | V1.1 VALIDÉ : **onglet Versements**                          | Ajouté au compte du commerçant                 |
| Commerçant : « Sur place »                          | Touch & Collect et livraison seulement                       | Retiré (arbitrage 4)                           |

## La charte graphique (direction A)

Source : [05-charte-graphique-a.jpg](utilisateur/05-charte-graphique-a.jpg). Signature : **« Le bon
plan, partout. »**

| Couleur         | Code      | Usage                                                         |
| --------------- | --------- | ------------------------------------------------------------- |
| Rose / fuchsia  | `#FF1478` | Couleur principale : Flash, prix, appels à l’action, fidélité |
| Bleu électrique | `#00B2FF` | Appui : localisation, site, infos, navigation secondaire      |
| Vert succès     | `#22C55E` | Signal : validé, confirmé, livraison, paiement                |
| Blanc           | `#FFFFFF` | Texte principal en mode Nuit, contraste                       |
| Gris foncé      | `#1B1B1F` | Fonds de cartes, éléments secondaires en mode Nuit            |

Principes affichés : **contraste élevé, lisibilité maximale, énergie et modernité, parcours
simple**. Toutes les maquettes existent en **mode Nuit et mode Jour**, avec une bascule
« Nuit / Jour » visible dans l’interface.

## Ce que montrent les écrans

**Inscription** (commerçant et utilisateur) — logo, titre, sous-titre ; pastille d’avatar ou de
boutique ; champs à icône : prénom, nom, e-mail, téléphone avec indicatif, mot de passe et
confirmation avec œil ; côté commerçant : nom du commerce, catégorie, SIRET, adresse, ville, modes
de remise ; case CGU et politique de confidentialité ; bouton principal rose, bouton secondaire
contour « J’ai déjà un compte » ; rangée de réassurance en pied.

**Accueil consommateur (B)** — avatar et prénom, logo, ville ; bascule **Liste / Carte** ; filtres
et panier avec pastille ; recherche « Je sais ce que je veux… » ; bannière « Vente Flash » avec
minuteur ; catégories en tuiles ; zone **« Ça part maintenant »** (« 2 pour vous · 21 en tout ») ;
carte d’offre : minuteur, remise, « 5 restants », commerçant et note, distance, prix, prix barré,
« Reste 5 sur 18 » avec jauge, bouton « + Ajouter ».

**Offre Flash (A)** — bandeau « OFFRE FLASH », remise en pastille, prix barré et prix Flash, « FIN
DANS » en heures / minutes / secondes, jauge « Stock restant 16 / 50 », distance, bouton
**« J’EN PROFITE ! »**, raccourcis Site / Fidélité / Infos du commerce.

**Fidélité chez un commerce (B)** — commerce, note, ville, « Ouvert » ; solde de points **chez ce
commerce** et progression vers la prochaine récompense ; « Mon historique » ; « Mes récompenses »
(disponible → « Utiliser », à débloquer → cadenas) ; historique des points.

**Accueil commerçant** — commerce vérifié et ville ; bloc « Nouveau Flash » (Flash actifs,
opérations gratuites restantes, « Créer un Flash ») ; indicateurs du jour ; grille d’accès ; « Flash
en cours » ; « Commandes récentes » avec statuts (À préparer, En livraison, Prête) ; résumé
fidélité ; barre **Accueil · Commandes · Flash · Fidélité · Compte**.

**Validation livreur (côté commerçant)** — étapes Commande prête → Remise au livreur → Terminée ;
commande, client, articles, adresse ; livreur, véhicule, « Compte vérifié », « Présent » ;
**validation biométrique faite sur l’appareil du livreur** (conforme à la biométrie locale du
CDC) ; « Identité validée » ; « Remettre le colis » ; chronologie ; **« Signaler un problème »**.
