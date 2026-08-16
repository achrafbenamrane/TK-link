---
read-when: 'Vous implémentez ou modifiez un parcours (consommateur, commerçant, grossiste, livreur)'
owns: 'Les quatre parcours en 12 étapes remis par le client le 16/08/2026, et leurs statuts'
---

# Les quatre parcours, tels que le client les a dessinés

> **D’où ça vient.** Farid a remis le 16/08/2026 quatre schémas — grossiste, livreur, consommateur,
> commerçant — chacun en douze étapes, avec ses contrôles de sécurité et ses statuts. Ils
> accompagnent le [cahier des charges V1.0](../architecture/exec-plans/2026-08-16-cdc-v1.md) et le
> précisent : là où le CDC décrit en prose, les schémas donnent **l’ordre exact des étapes et le nom
> des statuts**.
>
> Ce fichier existe parce qu’une image dans une conversation se perd. Le code doit pouvoir être
> confronté à cette liste sans rouvrir Slack.

## Ce que le client a tranché en même temps

> « La première incohérence, c’est que la vidéo envoyée était avec le boîtier, qui n’est pas encore
> lié à TKlink. **On reste uniquement sur du soft (pour l’instant).** »

Aucun des quatre schémas ne montre de lecteur, de carte physique ni de pastille. Le CDC V1.0 n’en
parle plus non plus. **Tout ce qui suppose du matériel est hors périmètre.**

Il ajoute que l’**UI viendra en second temps** — « taille et forme des boutons, timer, stock… ».
Ce document décrit donc des FONCTIONS, pas une maquette.

## Consommateur

| #   | Étape                         | Ce qu’elle contient                              |
| --- | ----------------------------- | ------------------------------------------------ |
| 1   | Téléchargement                | application mobile                               |
| 2   | Création du compte            | nom, téléphone, e-mail, mot de passe             |
| 3   | Choix des centres d’intérêt   | restauration, high-tech, mode, maison, loisirs…  |
| 4   | Activation de la localisation | offres proches et pertinentes                    |
| 5   | Sécurisation du compte        | appareil enregistré + authentification sécurisée |
| 6   | Compte validé                 | accès à l’univers TKLINK                         |
| 7   | Découverte des offres Flash   | bons plans en temps réel autour de vous          |
| 8   | Sélection d’une offre         | prix Flash, quantité, durée                      |
| 9   | Ajout au panier               | **stock réservé**                                |
| 10  | Validation & paiement         | commande confirmée, paiement sécurisé            |
| 11  | Suivi de commande             | Touch & Collect ou livraison                     |
| 12  | Confirmation finale           | commande reçue, ticket + points fidélité         |

**Statuts :** Offre repérée → Panier → Commande créée → Payée → Acceptée → Prête → En livraison /
retrait → Terminée

**Contrôles :** compte vérifié · paiement sécurisé · géolocalisation utile · tickets & fidélité

## Commerçant

| #   | Étape                          | Ce qu’elle contient                                     |
| --- | ------------------------------ | ------------------------------------------------------- |
| 1   | Téléchargement / accès web pro | app mobile **ou** tableau de bord commerçant            |
| 2   | Création du compte             | nom, téléphone, e-mail, mot de passe                    |
| 3   | Dépôt des informations pro     | SIRET, identité, adresse, **coordonnées bancaires**     |
| 4   | Vérification du profil         | contrôle des informations **par TKLINK**                |
| 5   | Sécurisation du compte         | appareil enregistré + authentification sécurisée        |
| 6   | Compte validé                  | accès au tableau de bord commerçant                     |
| 7   | Paramétrage de la boutique     | horaires, zone, Touch & Collect, livraison              |
| 8   | Création d’une offre Flash     | photo, prix initial, prix Flash, quantité, durée        |
| 9   | Publication de l’offre         | mise en ligne **en temps réel**                         |
| 10  | Réception d’une commande       | notification client, **stock réservé**                  |
| 11  | Validation & préparation       | **ticket cuisine / impression**, préparation, emballage |
| 12  | Confirmation finale            | Touch & Collect **ou remise livreur**                   |

**Statuts :** Offre brouillon → Offre active → Commande reçue → Acceptée → En préparation → Prête →
Remise client / livreur → Terminée

## Grossiste / fournisseur

Même ossature que le commerçant, avec quatre différences qui comptent :

- **7 — Paramétrage du catalogue** : stocks, **lots**, **prix pro**, livraison.
- **8 — Création d’une offre pro** : photo, lot, **prix grossiste**, quantité, durée.
- **9 — Publication** : mise en ligne **B2B** en temps réel.
- **12 — Confirmation finale** : **remise transporteur** ou livraison, suivi intégré.

**Statuts :** Offre brouillon → Offre active → Commande reçue → Acceptée → En préparation →
**Expédiée** → Livrée → Terminée

Le grossiste expédie, le commerçant remet en main propre : leurs statuts divergent à l’avant-dernière
étape, et les confondre ferait mentir l’un des deux écrans.

## Livreur

| #   | Étape                       | Ce qu’elle contient                                               |
| --- | --------------------------- | ----------------------------------------------------------------- |
| 1   | Téléchargement              | application mobile                                                |
| 2   | Création du compte livreur  | nom, téléphone, e-mail, mot de passe                              |
| 3   | Dépôt des informations      | **pièce d’identité, selfie**, coordonnées, **zone d’activité**    |
| 4   | Vérification du profil      | contrôle des informations par TKLINK                              |
| 5   | Sécurisation du compte      | appareil enregistré + **biométrie locale**                        |
| 6   | Compte validé               | accès au tableau de bord livreur                                  |
| 7   | Activation de disponibilité | le livreur **se met en ligne**                                    |
| 8   | Réception d’une mission     | notification avec **point de retrait et destination**             |
| 9   | Acceptation de la mission   | **estimation, distance, gain, délai**                             |
| 10  | Retrait chez le commerçant  | navigation, **scan QR ou code PIN**, biométrie si colis important |
| 11  | Livraison chez le client    | suivi, navigation, remise du colis                                |
| 12  | Confirmation finale         | **preuve de remise**, validation, mission terminée                |

**Statuts :** Disponible → Mission reçue → Acceptée → En route commerçant → Prise en charge → En
livraison → Livrée

⚠️ **La biométrie est LOCALE.** Le CDC §7.2 est explicite : TKLINK ne doit pas stocker centralement
l’empreinte brute. Le schéma dit la même chose — « empreinte digitale locale ». Un écran qui
laisserait croire que TKLINK garde l’empreinte serait un écart grave, pas une approximation.

## Ce que les affiches ajoutent

Les quatre affiches commerciales montrent la carte Flash telle que le client la voit :

- **Compte à rebours en HH : MM : SS**, avec les unités écrites dessous (H, MIN, SEC).
- **Stock restant sous forme « 27 / 100 »** avec une barre de progression.
- **Distance** — « à 0,4 km de toi ».
- **Note** — « 4,8/5 », et le nombre d’avis.
- **Prix barré + prix Flash + pourcentage de remise**, les trois ensemble.
- Un seul appel à l’action : « **J’EN PROFITE** ».
- Côté B2B : « Fournisseur Premium », « Livraison demain », « Retour possible sous 7 jours ».

## Écarts de vocabulaire à surveiller

Les schémas et le CDC ne nomment pas toujours les statuts pareil — c’est normal, l’un est un visuel,
l’autre un contrat. **En cas de conflit, le CDC fait foi** (§5.2 pour les commandes). Deux
divergences relevées :

| Schéma            | CDC §5.2                  |
| ----------------- | ------------------------- |
| « Offre repérée » | pas un statut de commande |
| « Prête »         | présent dans les deux     |
| « Terminée »      | présent dans les deux     |

Le CDC ajoute par ailleurs des états d’exception que les schémas ne montrent pas : **refusée,
annulée, remboursement en cours, remboursée, litige**.
