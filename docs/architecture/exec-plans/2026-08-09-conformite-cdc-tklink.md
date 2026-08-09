# Exec Plan — Conformité au CDC TKLINK

- **Date :** 2026-08-09
- **Auteur :** agent + PROGIX
- **Intent :** `CDC_TKLINK.pdf` V0.1 — Farid × PROGIX
- **Statut :** in-progress

## Objectif & non-objectifs

Amener l’app et le web au niveau du cahier des charges, section par section.
« Fait » se mesure ici de façon binaire : chaque point numéroté du CDC est
soit implémenté et testé, soit listé comme reste-à-faire avec sa phase.

**Non-objectifs de ce plan :** le matériel (bornes, lecteur de carte), l’IA, et
les 9 questions ouvertes du CDC §23 — elles appellent une décision de Farid, pas
du code. Là où le CDC propose lui-même une valeur (8 catégories, 0,99 €, 5 %,
2 ans), on l’implémente comme valeur par défaut modifiable, sans attendre.

## Carte de conformité — CDC vs code au 2026-08-09

| §   | Point du CDC                                                                  | État                                                   | Où                                          |
| --- | ----------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------- |
| 3   | 4 rôles : consommateur, commerçant, grossiste, livreur                        | ✓ — livreur exclu (app à part, §23 Q5)                 | `shared/lib/roles.ts`                       |
| 3.2 | Le commerçant voit les offres des grossistes                                  | ✓ règle testée                                         | `shared/lib/roles.ts`                       |
| 4   | Onboarding : choix du rôle                                                    | ✓ étape dédiée + parcours adapté                       | `onboarding/ui/onboarding-screen.tsx`       |
| 4   | Onboarding : domaines d’intérêt                                               | ✓ les 8 catégories du CDC                              | `shared/lib/categories.ts`                  |
| 5   | Inscription : prénom, nom, email, téléphone, mdp + confirmation, localisation | ✓ formulaire complet                                   | `auth/ui/sign-up-screen.tsx`                |
| 5   | SIRET obligatoire pour commander chez un grossiste                            | ✓ Luhn + garde de commande                             | `shared/lib/roles.ts`                       |
| 6   | Auth email + mot de passe                                                     | ✓                                                      | `auth/ui/sign-in-screen.tsx`                |
| 6   | Auth empreinte digitale                                                       | ✓                                                      | `shop/ui/biometrics-screen.tsx`             |
| 7   | Accueil : catégories, recherche, offres, compteur, quantité, prix             | ✓                                                      | `shop/ui/home-screen.tsx`                   |
| 7   | Accueil : identité de l’utilisateur                                           | ✗ absent — l’entête montre la marque, pas la personne  | idem                                        |
| 7   | Offres des catégories d’intérêt en priorité                                   | ✗ absent — le tri est par urgence seule                | `shop/lib/urgency.ts`                       |
| 8   | Offre : image, prix initial, prix promo, quantité, compteur, achat            | ✓                                                      | `shop/ui/components/flash-card.tsx`         |
| 9   | Offres flash publiées par le commerçant                                       | ✗ absent (côté commerçant)                             | —                                           |
| 9   | 5 opérations gratuites puis packs payants                                     | ✗ absent                                               | —                                           |
| 10  | Panier                                                                        | ✓                                                      | `shop/ui/cart-screen.tsx`                   |
| 11  | 10 statuts de commande                                                        | ~ partiel — 3 statuts sur 10                           | `shop/model/schema.ts`                      |
| 12  | Click & Collect                                                               | ✗ absent                                               | —                                           |
| 12  | Livraison                                                                     | ~ suivi présent, pas de livreur                        | `shop/ui/components/delivery-tracker.tsx`   |
| 13  | Points par achat, paliers, avantages                                          | ✓                                                      | `loyalty/lib/tiers.ts`                      |
| 13  | Partage de points entre utilisateurs                                          | ✓                                                      | `shop/ui/components/share-points-sheet.tsx` |
| 14  | QR Code : Transaction → Ticket → Facture                                      | ~ écrans présents, chaîne non reliée                   | `receipts/`, `coupons/`                     |
| 15  | Module de facturation                                                         | ~ facture générée, mentions légales à valider (§23 Q7) | `receipts/lib/receipts.ts`                  |
| 16  | Conservation / suppression des factures                                       | ✗ absent (§23 Q8 ouverte)                              | —                                           |
| 17  | Web Super Admin — Farid                                                       | ✗ absent                                               | `landing/`                                  |
| 18  | Web commerçants et grossistes                                                 | ~ vitrine seule, aucune gestion                        | `landing/pro/`                              |
| 19  | App mobile client                                                             | ✓                                                      | `src/`                                      |
| 19  | App mobile commerçant                                                         | ✗ absent                                               | —                                           |
| 19  | App mobile livreur                                                            | ✗ absent (§23 Q5 ouverte)                              | —                                           |
| 20  | B2B : offres grossiste → commerçant                                           | ✗ absent                                               | —                                           |
| 21  | Commission 5 %, packs, premium 12–24 h d’avance                               | ✗ absent                                               | —                                           |
| 22  | Cas d’incident de livraison                                                   | ✗ absent (§23 Q5a ouverte)                             | —                                           |

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

- [ ] Les 10 statuts + machine à états (transitions légales seulement)
- [ ] Click & Collect vs Livraison porté par la commande
- [ ] Migration Zod des commandes déjà stockées (3 statuts → 10)

### Phase 3 — L’accueil conforme (CDC §7)

- [ ] Identité de l’utilisateur dans l’entête
- [ ] Priorité aux catégories d’intérêt, urgence en second critère

### Phase 4 — B2B et offres flash commerçant (CDC §9, §20, §21)

- [ ] Offres grossiste visibles des seuls commerçants
- [ ] Quota 5 opérations gratuites, puis packs
- [ ] Commission 5 % au niveau du modèle

### Phase 5 — Web (CDC §17, §18)

- [ ] Portail commerçant/grossiste : offres, commandes, stock, CA
- [ ] Super Admin Farid : statistiques, gestion des inscrits

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
