# Exec Plan — Conformité au CDC TKLINK

- **Date :** 2026-08-09
- **Auteur :** agent + PROGIX
- **Intent :** `CDC_TKLINK.pdf` V0.1 — Farid × PROGIX
- **Statut :** in-progress — carte à jour au 2026-08-10

## Objectif & non-objectifs

Amener l’app et le web au niveau du cahier des charges, section par section.
« Fait » se mesure ici de façon binaire : chaque point numéroté du CDC est
soit implémenté et testé, soit listé comme reste-à-faire avec sa phase.

**Non-objectifs de ce plan :** le matériel (bornes, lecteur de carte), l’IA, et
les 9 questions ouvertes du CDC §23 — elles appellent une décision de Farid, pas
du code. Là où le CDC propose lui-même une valeur (8 catégories, 0,99 €, 5 %,
2 ans), on l’implémente comme valeur par défaut modifiable, sans attendre.

## Carte de conformité — CDC vs code au 2026-08-10

| §   | Point du CDC                                                                  | État                                                                        | Où                                          |
| --- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------- |
| 3   | 4 rôles : consommateur, commerçant, grossiste, livreur                        | ✓ — livreur exclu (app à part, §23 Q5)                                      | `shared/lib/roles.ts`                       |
| 3.2 | Le commerçant voit les offres des grossistes                                  | ✓ règle testée                                                              | `shared/lib/roles.ts`                       |
| 4   | Onboarding : choix du rôle                                                    | ✓ étape dédiée + parcours adapté                                            | `onboarding/ui/onboarding-screen.tsx`       |
| 4   | Onboarding : domaines d’intérêt                                               | ✓ les 8 catégories du CDC                                                   | `shared/lib/categories.ts`                  |
| 5   | Inscription : prénom, nom, email, téléphone, mdp + confirmation, localisation | ✓ formulaire complet                                                        | `auth/ui/sign-up-screen.tsx`                |
| 5   | SIRET obligatoire pour commander chez un grossiste                            | ✓ Luhn + garde de commande                                                  | `shared/lib/roles.ts`                       |
| 6   | Auth email + mot de passe                                                     | ✓                                                                           | `auth/ui/sign-in-screen.tsx`                |
| 6   | Auth empreinte digitale                                                       | ✓                                                                           | `shop/ui/biometrics-screen.tsx`             |
| 7   | Accueil : catégories, recherche, offres, compteur, quantité, prix             | ✓                                                                           | `shop/ui/home-screen.tsx`                   |
| 7   | Accueil : identité de l’utilisateur                                           | ✓ avatar + prénom, cliquable                                                | `app/(tabs)/index.tsx`                      |
| 7   | Offres des catégories d’intérêt en priorité                                   | ✓ intérêt d’abord, urgence ensuite                                          | `shop/lib/urgency.ts`                       |
| 8   | Offre : image, prix initial, prix promo, quantité, compteur, achat            | ✓                                                                           | `shop/ui/components/flash-card.tsx`         |
| 9   | Offres flash publiées par le commerçant                                       | ✓ app + web pro                                                             | `merchant/ui/offers-screen.tsx`             |
| 9   | 5 opérations gratuites puis packs payants                                     | ~ quota et packs tenus ; paiement réel absent                               | `merchant/lib/billing.ts`                   |
| 10  | Panier                                                                        | ✓                                                                           | `shop/ui/cart-screen.tsx`                   |
| 11  | 10 statuts de commande                                                        | ✓ + machine à états                                                         | `shop/lib/order-status.ts`                  |
| 12  | Click & Collect                                                               | ✓ choix au panier, frais annulés                                            | `shop/ui/cart-screen.tsx`                   |
| 12  | Livraison                                                                     | ~ suivi présent, pas de livreur                                             | `shop/ui/components/delivery-tracker.tsx`   |
| 13  | Points par achat, paliers, avantages                                          | ✓                                                                           | `loyalty/lib/tiers.ts`                      |
| 13  | Partage de points entre utilisateurs                                          | ✓                                                                           | `shop/ui/components/share-points-sheet.tsx` |
| 14  | QR Code : Transaction → Ticket → Facture                                      | ✓ chaîne reliée (commande honorée → ticket → facture)                       | `shop/lib/transactions.ts`, `app/_layout`   |
| 15  | Module de facturation                                                         | ~ facture générée, mentions légales à valider (§23 Q7)                      | `receipts/lib/receipts.ts`                  |
| 16  | Conservation / suppression des factures                                       | ✓ 2 ans par défaut (§23 Q8), purge automatique, épinglage qui protège       | `receipts/lib/retention.ts`                 |
| 17  | Web Super Admin — Farid                                                       | ✓ inscrits, statistiques, revenus (données simulées)                        | `landing/app/admin/`                        |
| 18  | Web commerçants et grossistes                                                 | ~ tableau de bord, documents, création d'offre ; stock et commandes absents | `landing/app/pro/`                          |
| 19  | App mobile client                                                             | ✓                                                                           | `src/`                                      |
| 19  | App mobile commerçant                                                         | ~ espace commerçant DANS l'app client ; pas d'app dédiée                    | `merchant/`, `app/mes-offres.tsx`           |
| 19  | App mobile livreur                                                            | ✗ absent (§23 Q5 ouverte)                                                   | —                                           |
| 20  | B2B : offres grossiste → commerçant                                           | ✓ marché, garde SIRET (§5), commandes en gros                               | `merchant/ui/wholesale-screen.tsx`          |
| 21  | Commission 5 %, packs, premium 12–24 h d’avance                               | ~ commission calculée et affichée ; facturation et premium absents          | `merchant/lib/billing.ts`                   |
| 22  | Cas d’incident de livraison                                                   | ✗ absent (§23 Q5a ouverte)                                                  | —                                           |

**Lecture :** le parcours consommateur est largement conforme. Ce qui manque est
d’une autre nature — c’est la **structure multi-rôles** dont dépendent §3, §4,
§5, §9, §18, §19, §20 et §21. Elle passe donc en premier : tant qu’un compte n’a
pas de rôle, aucune de ces sections ne peut exister.

## Existant à réutiliser — ne pas recréer

- `src/features/onboarding/` — store profil (prénom, avatar, intérêts) : le rôle s’y ajoute.
- `src/features/auth/` — connexion + schéma Zod : l’inscription s’y ajoute.
- `src/features/shop/model/schema.ts` — `OrderSchema`, `MerchantApplicationSchema`.
- `src/features/shop/lib/preferences.ts` — filtrage déjà en place ([[filterDeals]]).
- `src/features/loyalty/` — points, paliers, partage : conformes au §13.

## Phases

### Phase 1 — Le socle multi-rôles (CDC §3, §4, §5, §20)

- [x] Rôles `consommateur | commercant | grossiste` + règle de visibilité
- [x] Validation SIRET réelle (14 chiffres, clé de Luhn) — §5
- [x] Blocage : pas de commande grossiste sans SIRET — §5
- [x] Les 8 catégories du CDC §23 Q2 remplacent les 7 intérêts
- [x] Onboarding : étape rôle, puis étape catégories adaptée au rôle
- [x] Inscription complète : prénom, nom, email, téléphone, mdp + confirmation, localisation, SIRET conditionnel
      **Preuve :** tests unitaires sur `roles.ts` et `registration.ts` ; `npm run verify` vert.

### Phase 2 — Le contrat de commande (CDC §11, §12)

- [x] Les 10 statuts + machine à états (transitions légales seulement)
- [x] Click & Collect vs Livraison porté par la commande
- [x] Migration Zod des commandes déjà stockées (3 statuts → 10)
      **Preuve :** 21 tests dont la migration des commandes stockées ; 475 au total.

**Question remontée à Farid :** le §11 n'a pas de statut « en cours de
livraison », entre « prête » et « livrée ». L'app affichait déjà le trajet du
livreur. En attendant l'arbitrage, une commande confiée au livreur reste
« prête ».

### Phase 3 — L’accueil conforme (CDC §7)

- [x] Identité de l’utilisateur dans l’entête
- [x] Priorité aux catégories d’intérêt, urgence en second critère
      **Preuve :** 4 tests sur `sortForInterests` ; 482 au total.

### Phase 4 — B2B et offres flash commerçant (CDC §9, §20, §21)

- [x] Publication d'une vente flash par le commerçant, app et web pro
- [x] Offres grossiste visibles des seuls commerçants, garde SIRET du §5 branchée
- [x] Quota 5 opérations gratuites, puis packs
- [x] Commission 5 % au niveau du modèle, affichée AVANT d'être subie
- [ ] Facturation réelle des packs (attend RevenueCat + un compte)
- [ ] Avance premium de 12–24 h — §21
      **Preuve :** 41 tests sur `merchant` ; `npm run verify` vert.

### Phase 4 bis — la chaîne du ticket (CDC §11, §14)

- [x] Le commerçant voit et traite les commandes reçues, via la machine à états du §11
- [x] Commande honorée → ticket → facture certifiée
      **Preuve :** 21 tests (`transactions`, `order-chain`, `merchant-orders-screen`).

### Phase 5 — Web (CDC §17, §18)

- [x] Super Admin Farid : inscrits, statistiques, revenus — `landing/app/admin/`
- [x] Portail pro : tableau de bord, documents, création d'offre, quota et packs
- [ ] Portail pro : commandes reçues et stock (miroir de ce qui existe dans l'app)

## Risques & landmines

- **Réhydratation Zod.** Tout champ ajouté à un schéma persisté doit porter un
  `.default()`, sinon `safeParse` échoue et le store repart de zéro — panier et
  commandes effacés. Le piège est déjà documenté dans `shop/model/schema.ts`.
- **`holderType` existe déjà** (`particulier | pro`) et pilote l’audience des
  cadeaux fidélité. Le rôle CDC est un axe distinct : ne pas les fusionner.
- **Le SIRET est une donnée d’entreprise, pas un secret** — il est public au
  répertoire SIRENE. Il reste néanmoins de la donnée personnelle pour un
  auto-entrepreneur : il passe par `appStorage`, jamais dans un log.

## Vérification

- [x] `npm run verify` vert
- [ ] CUJ « inscription commerçant » ajouté à `docs/quality/critical-user-journeys.md`
- [x] Questions ouvertes du CDC §23 remontées au client
