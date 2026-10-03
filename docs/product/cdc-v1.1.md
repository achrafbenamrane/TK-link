---
read-when: 'Avant toute décision produit, tout nouvel écran, ou toute suppression : c’est le contrat client en vigueur'
owns: 'Le cahier des charges V1.1 du 31/08/2026 : son contenu, ce qu’il change par rapport à la V1.0, et ce que cela impose au code'
---

# Cahier des charges V1.1 — la référence en vigueur

> **D’où ça vient.** Farid Terki a transmis le 03/10/2026 la **V1.1 du 31/08/2026** (9 pages,
> « structure par famille »). Elle **restructure et met à jour** la
> [V1.0 du 13/08/2026](../architecture/exec-plans/2026-08-16-cdc-v1.md) « tout en conservant son
> contenu de fond, mis à jour par les arbitrages du 31 août 2026 ».
>
> **Règle de lecture :** là où la V1.1 dit autre chose que la V1.0, **la V1.1 gagne**. Là où elle
> se tait, **la V1.0 reste valable** (documents, archivage 10 ans, e-facturation, Super Admin,
> analytics, catégories, carte Flash, cycle de vie…).
>
> Les fichiers originaux ne sont pas dans le dépôt : `TKLINK_CDC_V1.1.pdf` (bureau du développeur)
> et `TKLINK_CDC_V1.1.docx`. Ce fichier en est la transcription fidèle, pour qu’aucun agent n’ait à
> rouvrir une pièce jointe.

## Les statuts

| Statut                                  | Sens                                                               |
| --------------------------------------- | ------------------------------------------------------------------ |
| **EXIGENCE**                            | Règle déjà actée dans la V1.0, reprise sans changement             |
| **VALIDÉ**                              | Décision prise ou précisée lors des arbitrages du 31/08/2026       |
| **CANDIDAT**                            | Proposition non actée — **confirmation requise avant intégration** |
| **ANALYSE EN COURS / DONNÉE MANQUANTE** | Point laissé ouvert — **ne pas trancher côté développement**       |

## Le circuit de l’argent (section transverse)

- **Flux de base.** L’utilisateur paie via **Stripe Connect**, qui exécute le split : le commerçant
  reçoit le prix diminué de la commission, TK Link perçoit la commission. Systématique.
- **La fidélité est un circuit séparé.** Elle ne transite **jamais** par Stripe ni par TK Link : les
  points sont calculés et attribués par le commerçant sur son propre programme. Elle n’affecte ni la
  commission ni le reversement.
- **Parrainage et Flash boosté : un même mécanisme.** Une injection de TK Link dans le split Stripe,
  au même point que la commission. Le commerçant perçoit toujours son prix plein moins la commission
  normale ; TK Link comble l’écart avec ce que paie le client.
  - **Parrainage** : 5 € crédités au parrain **et** au filleul, débloqués après un premier achat réel
    du filleul.
  - **Flash boosté** : TK Link finance une partie du prix sur les premières unités d’une opération
    choisie, dans la limite d’un budget de campagne.
  - Prérequis commun : configuration Stripe Connect en **Direct charges** (encore à vérifier).

### Parcours de référence — une commande simple

1. **Découverte** — les Flash actifs près de l’utilisateur, triés selon ses catégories choisies à
   l’onboarding. Chaque carte : photo, commerçant, distance, prix initial, prix Flash, stock
   restant, compte à rebours.
2. **Choix du mode de remise** — avant de payer : Touch & Collect (**gratuit**) ou livraison, dont le
   **coût s’affiche immédiatement**. Aucun frais ne se révèle après coup.
3. **Paiement** — prix et stock revérifiés côté serveur, de façon atomique. C’est ici que s’appliquent
   un crédit de parrainage ou un Flash boosté.
4. **Confirmation** — écran de confirmation **avec QR** côté client ; au même instant, un ticket avec
   **étiquette QR détachable** s’imprime chez le commerçant. **Le paiement vaut acceptation, sans
   étape intermédiaire.**
5. **Retrait ou livraison** — Touch & Collect : l’étiquette collée sur le produit sert à la
   vérification au comptoir. Livraison : un livreur **TK Deliver** récupère le produit étiqueté, avec
   preuve de remise.
6. **Après la commande** — l’utilisateur peut **noter le commerçant** (étoiles + tags rapides). Si le
   commerçant a un programme de fidélité actif, les points s’ajoutent chez **ce** commerce.

## 1 — Grossiste (fournisseur B2B)

**Règle**

- EXIGENCE — SIRET et informations professionnelles **vérifiés** avant toute publication ou commande
  B2B.
- EXIGENCE — Une offre B2B est ponctuelle **ou récurrente** (republication automatique au rythme
  choisi). Même Flash Engine que le B2C : **pas de catalogue distinct**.
- VALIDÉ — **Quantité minimale de commande** configurable par offre ; le panier acheteur ne valide
  pas en dessous.
- VALIDÉ — **Commission B2B = 5 %**, alignée sur le B2C. Remplace la règle V1.0 qui interdisait ce
  calque.
- VALIDÉ — Le grossiste reste le vendeur légal ; TK Link facture sa commission au professionnel.

**Process**

- EXIGENCE — Inscription, vérification SIRET, publication réservée aux professionnels vérifiés.
- EXIGENCE — Réception et traitement des commandes des commerçants.
- VALIDÉ — Commande passée et payée ⇒ **ticket de préparation à étiquette QR imprimé
  automatiquement**, comme chez le commerçant.
- VALIDÉ — **Aucune étape d’acceptation**, même pour les commandes de volume.
- EXIGENCE — Statistiques B2B séparées des statistiques B2C.

**Flux finance**

- VALIDÉ — Commission 5 %.
- VALIDÉ — **Paiement instantané dans l’app** pour toutes les commandes B2B en V1. Pas de délai de
  paiement à construire ; un accord préexistant se gère hors application.
- EXIGENCE — Facturation grossiste → commerçant, mentions obligatoires, conservation 10 ans,
  réception de facture électronique dès le 01/09/2026.

**Points** — CANDIDAT : 1 € HT dépensé en B2B = 1 point, à valider.

## 2 — Commerçant (interface professionnelle, « TK Pro »)

**Règle**

- EXIGENCE — **5 opérations Flash gratuites**, nombre réglable au Super Admin, jamais codé en dur.
- VALIDÉ — **Durée d’un Flash : 15 minutes minimum, 2 heures maximum.**
- VALIDÉ — **Un compte = un établissement** en V1. Pas de multi-sites.
- EXIGENCE — Commission B2C 5 %, configurable.
- VALIDÉ — TK Link est **intermédiaire** : le commerçant reste vendeur légal (produit, TVA) ; TK Link
  facture uniquement sa commission. À formaliser dans les CGU, CGV et le contrat commerçant.
- VALIDÉ — **Pas de sous-comptes ni de rôles internes.** L’écran par défaut de l’appareil pendant le
  service est **la liste des commandes en cours** — ni réglages ni chiffres — pour qu’un employé
  marque une commande prête sans voir le reste.

**Process**

- EXIGENCE — Inscription avec SIRET ; établissement, horaires, profil (**photos, vidéos,
  présentation**).
- EXIGENCE — Création d’un Flash en 8 étapes : photo, titre, prix de référence, prix Flash,
  quantité, durée ou heure de fin, mode de remise, publication immédiate **ou programmée (jusqu’à la
  veille, déclenchement automatique)**.
- VALIDÉ — Commande payée ⇒ une **imprimante à étiquettes thermique autonome** (Bluetooth ou USB,
  reliée à l’appareil TK Pro) imprime un ticket de préparation avec une **partie autocollante
  détachable portant le QR** de la commande, à coller sur le produit. **Aucune intégration de caisse
  tierce n’est requise.**
- EXIGENCE — Stock Flash en temps réel ; réservation et vente atomiques côté serveur.
- EXIGENCE — Configuration du programme de fidélité.
- EXIGENCE — Consultation et commande des offres B2B via **l’onglet grossiste**.
- CANDIDAT — Sponsoriser un lot dans les mini-jeux en finançant un coupon promotionnel.

**Flux finance**

- EXIGENCE — Commission de 5 % sur chaque transaction B2C.
- VALIDÉ — Un **onglet Versements** affiche le calendrier et les montants issus de Stripe Connect.
  TK Link ne construit pas de moteur de trésorerie.
- ANALYSE EN COURS — Vérifier que Stripe Connect est en **Direct charges** (commerçant = merchant
  of record). Des Destination charges contrediraient les CGU/CGV.
- EXIGENCE — Facturation commerçant → client ; **ticket B2C gratuit** ; facturation B2B certifiée
  **payante, dégressive par palier de volume**.

**Points**

- EXIGENCE — Jusqu’à **4 paliers** : seuil, récompense, description, durée et quantité éventuelles.
- EXIGENCE — Le commerçant choisit **l’unité de calcul (nombre d’achats ou euros cumulés)** à la
  création du programme ; **non modifiable une fois en ligne**.
- VALIDÉ — **Seule une récompense débloquée est partageable** entre comptes ; **les points bruts ne
  sont jamais transférables**, sous aucune forme.
- EXIGENCE — Points liés au programme du commerçant ; non convertibles, non remboursables, non
  revendables.

## 3 — Utilisateur (consommateur B2C)

**Règle**

- EXIGENCE — Onboarding : une, plusieurs ou les 8 catégories, modifiables à tout moment ; elles
  priorisent le feed sans bloquer le reste.
- VALIDÉ — L’accès aux mini-jeux n’est **jamais conditionné à un achat** (cadre du jeu-concours
  gratuit, pas de la loterie).
- EXIGENCE — Le back-end est seul autoritaire sur prix, stock, expiration et statut de commande.

**Process**

- EXIGENCE — Découverte : accueil, zone **Flash Maintenant**, géolocalisation et carte à rayons
  configurables, filtres, favoris et alertes.
- EXIGENCE — Achat : revérification serveur, paiement sécurisé, Touch & Collect ou livraison **avec
  son coût affiché avant validation**, jamais de frais caché.
- EXIGENCE — Suivi : créée, paiement, acceptée, préparation, prête, retrait ou livraison, terminée ;
  exceptions : refusée, annulée, remboursement en cours, remboursée, litige.
- VALIDÉ — **Signaler un problème** : un point d’entrée unique sur l’écran de commande, qui route
  automatiquement vers un remboursement ou vers une file Super Admin selon l’incident.
- VALIDÉ — **Parrainage** : lien ou code d’invitation ; récompense financée par TK Link, débloquée
  pour les deux après un premier achat réel du filleul.
- VALIDÉ — **Mini-jeux** : jouer, gagner un coupon promotionnel, le retrouver dans l’**inventaire de
  récompenses**, le faire valider **par QR chez le commerçant** — même moteur que la fidélité.
  **3 jeux au lancement, développés comme un lot séparé, hors périmètre du pilote.**

**Flux finance** — EXIGENCE : paiement sécurisé, revérification serveur. DONNÉE MANQUANTE : panier
multi-commerçants.

**Points**

- EXIGENCE — **1 € TTC dépensé en produits = 1 point** ; livraison, frais de service et pourboire
  exclus par défaut.
- EXIGENCE — Points liés au commerce qui les a générés ; jamais convertibles, remboursables ni
  revendables.
- VALIDÉ — Seule la récompense débloquée se partage, jamais les points bruts.
- VALIDÉ — Après une commande terminée : **notation du commerçant** par étoiles et tags rapides,
  **sans texte libre** ; la moyenne s’affiche sur la vitrine du commerçant.
- VALIDÉ — Un coupon de mini-jeu est une récompense débloquée (même inventaire, même validation
  QR). Plafond de parties par jour et par numéro de téléphone vérifié.

## 4 — Livreur (« TK Deliver »)

**Règle**

- EXIGENCE — Identité vérifiée, terminal enrôlé, biométrie **locale** ; aucune empreinte centralisée.
- VALIDÉ — **Type de véhicule** (vélo, scooter, voiture) déclaré à l’inscription ; filtre
  d’attribution des missions.
- EXIGENCE — La course commence après l’achat verrouillé ; elle est **découplée du minuteur** du
  Flash.

**Process**

- EXIGENCE — Inscription, identité, enrôlement, sécurité, disponibilité ; mission, collecte, prise
  en charge, acheminement, remise avec preuve.
- VALIDÉ — **Flash national** : ramasse locale puis dépôt en point relais Chronopost ou Colissimo avec
  preuve de dépôt, sans API transporteur ; le client suit via le numéro de suivi.
- ANALYSE EN COURS — Procédures et responsabilités des incidents de livraison.

**Flux finance**

- VALIDÉ — **3,00 € par commande, puis 0,80 €/km** au-delà de la zone de base.
- EXIGENCE — Vigilance : revenu horaire minimum de 19 € brut/h depuis le 01/09/2026 pour les
  plateformes de livreurs indépendants ; applicabilité à confirmer, coût à budgéter.
- EXIGENCE — **Portefeuille de revenus et historique** consultables par le livreur.

**Points** — CANDIDAT : aucun système de points ; piste de prime de disponibilité en heure creuse.
ANALYSE EN COURS : notation interne non publique, pour les niveaux d’habilitation.

## Points encore ouverts — ne pas les trancher dans le code

- Applicabilité du revenu minimum de 19 €/h à TK Deliver.
- Flash national via Chronopost / Colissimo : confirmation définitive.
- **Durée de réservation du panier** : la réponse reçue (« 2 jours hors alimentaire ») semble
  répondre à une autre question que le verrou de stock pendant le paiement.
- **Panier multi-commerçants** : la réponse reçue (« un compte par magasin ») répond à la question
  des multi-établissements, pas à celle du panier.
- Critères des niveaux d’habilitation livreur.
- Remboursement de points déjà transférés ou utilisés.
- PSP et architecture monétique définitive.
- Qualification juridique exacte de l’intermédiation (commissionnaire, courtier…), à confirmer par
  un avocat.
- Vérification Stripe Connect en Direct charges.

Identité légale portée par le document : **SAS TKLINK**, 4 rue Claudio Monteverdi, 31600 Muret —
SIRET 924 878 275 00016 — RCS Toulouse B 924 878 275.

## Ce que la V1.1 renverse par rapport à la V1.0

| Sujet                   | V1.0                                           | V1.1                                                               |
| ----------------------- | ---------------------------------------------- | ------------------------------------------------------------------ |
| Commission B2B          | Analyse en cours, ne pas copier les 5 %        | **5 %, aligné sur le B2C**                                         |
| Partage de points       | Transfert de points entre utilisateurs, ledger | **Points bruts jamais transférables** ; récompense débloquée seule |
| Mini-jeux               | Absents                                        | **Validés, 3 au lancement, lot séparé, hors pilote**               |
| Acceptation de commande | Étape « acceptée » après paiement              | **Le paiement vaut acceptation**                                   |
| Ticket de préparation   | Routage POS / KDS ouvert, ZELTY candidat       | **Imprimante thermique autonome**, étiquette QR, sans caisse       |
| Durée d’un Flash        | Libre                                          | **15 min à 2 h**                                                   |
| Programmation           | Publier ou programmer                          | Programmer **jusqu’à la veille**                                   |
| Unité de fidélité       | 1 € = 1 point                                  | **Achats ou euros**, choisi à la création, puis figé               |
| Paiement                | PSP ouvert                                     | **Stripe Connect** (split), Direct charges à vérifier              |
| Écran commerçant        | —                                              | **Commandes en cours par défaut**, pas de sous-comptes             |
| Nouveaux mécanismes     | —                                              | Parrainage, Flash boosté, notation, signalement, Versements        |
| B2B                     | Offres Flash pro                               | + **récurrence**, **quantité minimale**, paiement instantané       |
| Livreur                 | Parcours sécurisé                              | + véhicule, **3 € + 0,80 €/km**, portefeuille, Flash national      |

## Ce que cela impose au code

Le plan d’exécution — ordre, commits, vérifications — est tenu dans
[l’exec plan V1.1](../architecture/exec-plans/2026-10-03-cdc-v1.1.md).

**À retirer de l’app du pilote**

- **Les mini-jeux** — la V1.1 les place hors du pilote. Le code n’est pas perdu : il reste dans
  l’historique git, sous l’étiquette `archive/mini-jeux-pre-v1.1`, pour le lot séparé des 3 jeux.
- **La gamification** (« La Chasse », XP, rangs, série, coffre, missions, trophées, classement) — ni
  la V1.0 ni la V1.1 ne la décrivent.
- **Les coupons et codes promo** — la V1.1 ne connaît que le coupon gagné à un mini-jeu, hors pilote.
- **Les « offres membres »** liées à l’ancienne carte physique.
- **Le transfert de points bruts** — interdit par la V1.1.
- **Les prix de packs inventés** — la tarification reste non tranchée.

**À corriger** — commission B2B à 5 %, acceptation automatique au paiement, durée de Flash bornée
à 15 min – 2 h, programmation limitée à la veille.

**À construire, avec les nouvelles maquettes et le back-end** — parrainage, notation, signalement
unique, inventaire de récompenses avec validation QR et partage de récompense, unité de fidélité
figée, onglet Versements, impression d’étiquettes, profil commerçant (photos, vidéos), B2B récurrent
et quantité minimale, livreur (véhicule, rémunération, portefeuille), Flash boosté, écran
« commandes en cours » par défaut.
