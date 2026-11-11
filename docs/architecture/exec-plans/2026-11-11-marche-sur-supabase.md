# Exec Plan — Brancher le marché sur Supabase

- **Date :** 2026-11-11
- **Auteur :** agent + opérateur
- **Intention :** un pilote réel — une Flash publiée par un commerçant est vue et commandée depuis un
  AUTRE téléphone. Aujourd’hui seule l’authentification parle au serveur
  ([2026-10-24-authentification.md](2026-10-24-authentification.md)) ; commerces, Flash, commandes,
  fidélité et livreurs vivent dans les stores locaux de chaque appareil.
- **Statut :** en cours

## Objectif et non-objectifs

Fini quand, sur deux téléphones : un commerçant dépose son dossier, TK LINK le valide, il publie une
Flash, un client l’aperçoit autour de lui, la réserve, et chacun voit la commande avancer jusqu’à
« récupérée ». Non-objectifs ici : paiement Stripe, livreurs, notifications push, B2B grossiste —
ils viennent après, sur les mêmes fondations.

## Décisions

- **Nouvelles tables, pas de réécriture de 0005.** `merchants`/`deals`/`orders` (0005) datent d’avant
  le CDC V1.1 (catégories, statuts, commerces sans propriétaire) et l’app ne les a jamais utilisées.
  On crée `shops`, puis `flash_offers` et `flash_orders` ; les anciennes tables seront retirées par
  une migration de nettoyage une fois leur vacuité constatée sur le projet.
- **Le serveur fait foi pour ce qui se partage** (statut du dossier, stock, prix, statut de
  commande) ; les stores locaux en gardent une copie lue, jamais l’inverse. Les prix et le stock ne
  sont JAMAIS calculés par le client (règles 1 et 2 de 0005, reprises).
- **Validation du dossier :** par TK LINK depuis le tableau de bord Supabase (une requête documentée)
  tant que l’admin `/admin` n’a pas de vraie connexion. Un changement de SIRET ou de nom après
  validation renvoie le dossier en vérification (déclencheur).
- **Pas de bibliothèque de cache pour l’instant** : un module `lib/*-api.ts` par feature, réponses
  passées par Zod avant le store (docs/architecture/state-management.md). TanStack Query sera
  réévalué (ADR) quand les listes en direct arriveront à l’étape 2.
- **Démonstration** : sans serveur, tout reste local comme avant ; avec serveur, le bouton
  « simuler la validation » et les pré-remplissages disparaissent (`isDemoShortcutAvailable`).

## Déjà existant — réutiliser

- `src/features/merchant/model/store.ts` (dossier `supplier`, offres, quota), `lib/supplier.ts`
- `src/features/merchant/ui/pro-setup-screen.tsx`, `src/app/dossier-pro.tsx`, `src/app/(tabs)/flash.tsx`
- `src/shared/lib/roles.ts` (`isValidSiret`), `src/shared/lib/categories.ts`
- `supabase/tests/database/rls.test.sql` (comptes a2 commerçant, a3 grossiste)

## Étapes

### Étape 1 — Le dossier du professionnel sur le serveur

- [x] Migration `0010_shops.sql` : table `shops` (un par compte), SIRET vérifié (Luhn) et unique,
      `kind` = type de compte déclaré, statut `en_verification | valide | refuse` hors de portée du
      client, retour en vérification sur changement sensible ; lecture publique des seuls validés
- [x] Tests pgTAP des invariants (`rls.test.sql`)
- [x] `merchant/lib/shop-api.ts` + store : dépôt du dossier sur le serveur, statut relu (onglet
      Flash, écran du dossier), statut `refuse` avec motif
- [x] Doc : requête de validation, `docs/security/checklist.md`
      **Preuve :** dossier déposé sur le téléphone → ligne `shops` ; validé dans Supabase → la
      publication s’ouvre sur le téléphone
- [x] 11/11 : 0010 appliquée sur le projet ; règles éprouvées sur le vrai serveur avec de vraies
      sessions (statut, dossier d’un client, clé SIRET, commerce d’un autre : tous refusés). Comptes
      de test client / commerçant / grossiste créés par script SQL (hors dépôt : il porte un mot de
      passe), dossiers validés. Reste : l’essai sur téléphone

### Étape 2 — Les Flash en direct

- [x] `flash_offers` (prix en centimes, stock, début/fin, modes, photo dans Storage) ; publication
      réservée aux commerces validés ; quota d’opérations offertes tenu par le serveur
- [x] Coordonnées du commerce (géocodage Mapbox de l’adresse) pour « autour de vous »
- [x] Accueil client et carte lisent les Flash du serveur (les exemples restent en démonstration)
      — la fiche produit, le panier, les favoris et la page du commerce les retrouvent par
      `getDeal`/`getMerchant`. Reste : offres pro (B2B) lues du serveur côté commerçant, récurrence
      des offres pro côté serveur

### Étape 3 — La commande

- [ ] `flash_orders` + `reserve_flash()` atomique (stock sous verrou, prix recalculé)
- [ ] Commerçant : commandes reçues et statuts ; client : suivi en direct

### Étape 4 — Fidélité et tickets rattachés aux commandes du serveur

## Risques

- Données locales existantes (offres publiées sur un appareil) : elles ne migrent pas vers le
  serveur — sans objet tant qu’aucun pilote n’a commencé.
- CLI Supabase inutilisable sur ce poste : migrations appliquées dans le SQL Editor, comme 0001–0009.
- Les tests pgTAP ne tournent pas ici (pas de Docker) : ils sont écrits, à lancer avec
  `supabase test db` sur un poste équipé.
