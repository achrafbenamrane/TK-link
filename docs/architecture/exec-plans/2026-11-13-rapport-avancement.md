# Exec Plan — Livrer ce qu’annonce le rapport d’avancement

- **Date :** 2026-11-13
- **Auteur :** agent + opérateur
- **Intention :** le chef de projet a remis au client un « Rapport d’avancement – Application
  mobile » (WhatsApp, 13/11/2026) qui annonce onze chantiers ; il faut que l’app les tienne, au plus
  vite. Décision du même jour : **Uber Direct remplace les livreurs TK LINK**.
- **Statut :** en cours

## Objectif et non-objectifs

Fini quand chaque ligne du rapport est vraie dans l’app, prouvée par un test et observée à l’écran.
Non-objectifs : immatriculation de la société et activation commerciale d’Uber Direct
(administratif, côté client) ; modèle économique de l’IA (le rapport le reporte).

## Décisions (13/11/2026, opérateur)

- **Paiement : Stripe Connect** (CDC V1.1 §2) — le client paie dans l’app, le commerçant reçoit le
  prix moins la commission (5 %, réglable), TK LINK la commission. Mode test tant que la société
  n’est pas immatriculée.
- **IA : fal.ai**, appelé par le serveur seulement (clé en secret Supabase) — images et vidéos.
- **Livreurs : retirés.** La livraison est commandée à Uber Direct par le serveur et suivie dans la
  commande ; le code livreur reste dans l’historique git.
- **Messagerie : support TK LINK.** Clients et commerçants écrivent à TK LINK ; chaque demande est
  un ticket suivi et répondu depuis le back-office.
- **Paiement par Stripe Checkout** (13/11, en cours de route) plutôt que la feuille native : même
  Stripe Connect, même partage, mais une page Stripe sécurisée ouverte depuis l’app (carte, Apple Pay,
  Google Pay). Aucun module natif : le paiement part par mise à jour OTA, sans nouvelle APK.
- Seules les notifications (`expo-notifications`) exigent une nouvelle APK.

## Déjà existant — réutiliser

- Compte à rebours : `src/features/shop/ui/components/countdown.tsx`
- Programmation : `src/features/merchant/ui/publish-form.tsx`, `merchant/lib/schedule.ts`
- Panier et commande locale : `shop/ui/cart-screen.tsx`, `shop/model/store.ts`, `lib/order-status.ts`
- Marché sur Supabase : [2026-11-11-marche-sur-supabase.md](2026-11-11-marche-sur-supabase.md)
  (étape 3 « la commande » = le socle du paiement)
- Messagerie locale : `src/features/messages/`, routes `(tabs)/messages`, `conversation/[id]`
- Packs : `packs/push-notifications`, `packs/chat-realtime`, `packs/media-upload`
- Back-office : `landing/app/admin/` (Vercel, mot de passe)

## Étapes

### 1 — Expérience utilisateur (sans dépendance externe)

- [x] Compte à rebours au centième de seconde, calculé sur le fil d’interface (Reanimated), arrêté
      à zéro pour une vraie Flash, sans centièmes si « réduire les animations »
- [x] Bloc du commerçant = un seul chemin vers sa boutique (carte Flash, fiche produit, carte)
- [x] Programmation d’une Flash simplifiée côté commerçant : Maintenant / Aujourd’hui / Demain
      puis un créneau à la demi-heure ; fin calculée depuis le créneau
      **Preuve :** aperçu web 13/11 (fiche produit, compte commerçant de test) ; c936265, 86606c7,
      c3fca43. En plus : accueil vide sans Flash = « Pas encore de Flash près de vous » (903d9e0)

### 2 — Uber Direct à la place des livreurs

- [x] Retrait du rôle livreur (0adedca, 1a4bc89) : feature, routes et onglets retirés ; un rôle
      « livreur » enregistré devient client à la relecture (test) ; la livraison se lit « Remise au
      coursier » → « En livraison » → « Livrée »
- [x] Serveur (13/11) : `uber-quote` (frais de livraison de la commande réservée),
      `uber-dispatch` (le commerçant commande la course, une seule par commande), `uber-webhook`
      (signé HMAC : en livraison, livrée, litige). Logique pure testée (`supabase/__tests__/uber`).
      Reste : l’annulation d’une course, l’essai réel (clés Uber Direct)
- [x] La commande en livraison affiche le statut et le lien de suivi Uber (client et commerçant)

### 3 — La commande et le paiement (Stripe Connect)

- [x] Migration 0012 : `flash_orders`, `reserve_flash()` sous verrou, prix et commission par
      le serveur, expiration des réservations, `advance_order`, `confirm_pickup`, code de retrait
      hors API ; tests pgTAP 36–46 (non lancés ici : pas de Docker)
- [x] Serveur : migration 0013 (compte Stripe du commerce), `stripe-connect`, `stripe-payment`
      (Direct charges, frais = commission + livraison − réduction), `stripe-webhook` ; pages de
      retour sur le site (`/stripe/retour`, `/stripe/relancer`)
- [x] App (1da23e5, ec616f4, 9845134) : panier → réservation, devis Uber, page Stripe Checkout ;
      fiche de commande relue toutes les 5 s (payer/annuler, code et QR de retrait, suivi Uber,
      « Signaler un problème » → support) ; commerçant : commandes payées du serveur, préparation,
      remise contre le code, course Uber ; « Versements » → inscription Stripe
- [x] Crédit de parrainage côté serveur (0019, voir § 7), scan du QR de retrait, annulation d’une
      course Uber par le commerçant (`uber-cancel`). Reste : Flash boosté (même obstacle Stripe)
- [x] Onglet Versements lu depuis Stripe : fonction `stripe-balance` (solde, virements) ; l’estimation
      reste dessous tant que Stripe ne répond pas

### 4 — Notifications

- [x] Serveur : migration 0016 (`push_tokens`, enregistrement par fonction), `push-events`
      (Database Webhooks : commandes et réponses du support) ; tests pgTAP 56–57
- [x] App : `expo-notifications` chargé sous garde (ADR-0011), jeton enregistré pour le compte
      connecté et retiré avant la déconnexion, toucher → écran de la commande ou de la demande (même
      app fermée). Reste : la nouvelle APK et `google-services.json` (Firebase) dans EAS

### 5 — Messagerie support et tickets

- [x] Migration 0014 (demandes, messages, statut qui suit la conversation, quota) ; tests pgTAP
      47–52 ; `/admin` → Messages lit et répond par une route serveur (clé de service, démonstration
      sans elle)
- [x] App : Profil → « Aide et support » (demandes, nouvelle demande, conversation en direct) ;
      la messagerie locale du livreur est retirée (f13bae3, CUJ-008)

### 6 — Contenu IA de la boutique

- [x] Serveur : migration 0015 (`shop_media`, quota 10 images / 2 vidéos par jour),
      `ai-media-start`, `ai-media-status` (copie dans Storage) ; tests pgTAP 53–55
- [x] App : « Ma boutique » → Visuels IA (création, suivi, montrer/cacher) ; visuels montrés sur la
      vitrine (f2f09b5, 5a7c649)

### 7 — Ce que le rapport ne disait pas, mais que le pilote exige

- [x] Fidélité sur le serveur (0017) : sans elle, une commande payée ne rapportait aucun point
- [x] Dossiers pros validés ou refusés depuis `/admin` (plus de requête SQL à taper)
- [x] Scanner le QR de retrait au comptoir
- [x] Factures des commandes du serveur (« Mes factures » ne lisait que les commandes locales)
- [x] Partager une récompense d’un commerce du serveur (0018, à appliquer) ; tests pgTAP 61 bis
- [x] Parrainage sur le serveur (0019), dans les limites du Stripe actuel : en Direct charges, la
      part de TK LINK ne peut pas être négative, donc le crédit se déduit à hauteur de la commission
      de chaque commande (≈ 0,35 € sur 7 €) et sert sur plusieurs commandes. **Décision ouverte** :
      tout déduire d’un coup exige de passer en « charges séparées et virements » (TK LINK encaisse,
      puis vire au commerçant son dû) — seule la borne de `reserve_flash` changerait

### Mise en service

- [x] 13/11/2026 : migrations 0011 à 0017 appliquées (SQL Editor, une transaction) ; `npm run auth:check`
      les voit toutes. Règles éprouvées sur le vrai serveur avec les comptes de test (19/19) : prix et
      commission calculés par le serveur, stock réservé puis rendu à l’annulation, pas de réservation
      au-delà du stock, aucun statut ni point ni « payé » écrit par un client, pas de message « au nom
      de TK LINK », commerçant sans saut d’étape ni encaissement auto-déclaré, aucune fuite entre
      comptes
- [x] 13/11/2026 : migration 0018 (partage des récompenses) appliquée ; `npm run auth:check` voit
      0007 à 0018 en place
- [x] Back-office : Vue d’ensemble, Comptes et Revenus lus dans les vraies tables (route
      `admin/api/stats` : comptes, Flash, volume vendu, commission du serveur, revenu net du crédit
      de parrainage, six mois glissants) ; la démonstration reste sans clé de service
- [x] Back-office : l’onglet Litiges lit les vraies commandes en litige et enregistre la décision
      motivée (0021) ; le remboursement se fait dans Stripe
- [ ] Migrations 0019 (parrainage, relue), 0020 (annulation avec page de paiement ouverte) et 0021
      (décisions sur les litiges) à appliquer dans le SQL Editor ; tests pgTAP 63–78
- [ ] Clés Stripe (test), Uber Direct, fal.ai ; fonctions Edge déployées ; webhooks déclarés
- [x] Mises à jour OTA publiées (dernière : be16f769 — factures serveur, partage des récompenses,
      13/11/2026)
- [ ] Essai sur deux téléphones
- [ ] Nouvelle APK (notifications) avec `google-services.json`

## Risques

- Disque presque plein sur ce poste (cf. mémoire) : vérifier `df -h` avant export ou build.
- Stripe et notifications exigent une nouvelle APK (quota EAS gratuit mensuel).
- Les fonctions Edge n’ont jamais été lancées sur ce poste (Deno absent). Depuis le 13/11/2026 elles
  sont typées par `npm run typecheck:edge` (tsc, dans `verify`) et relues deux fois ; reste à les
  éprouver au déploiement.
- Le back-office n’est protégé que par un mot de passe partagé : à rendre long et unique AVANT d’y
  mettre la clé de service (landing/DEPLOY.md).
- Uber Direct et fal.ai : rien ne s’éprouve sans les clés ; le code est testé sur des réponses
  enregistrées de la documentation, l’essai réel attend les comptes.
