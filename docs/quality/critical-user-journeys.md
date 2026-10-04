# Critical User Journeys

The flows that must never break. Every entry has: an owner, a Maestro flow
(deterministic gate), and agentic QA coverage (exploratory). Changing a CUJ's
behavior requires updating this file + its flow in the same PR (QA persona
enforces).

## CUJ-001 — Premier lancement

- **Owner :** squad produit TK LINK
- **Flow :** `.maestro/flows/smoke.yaml`
- **Journey :** ouvrir l’app → écran de bienvenue → « Passer » → onboarding :
  l’accroche, puis **la proposition de compte**, puis la personnalisation
  (rôle, avatar, prénom, centres d’intérêt) → l’accueil affiche le déstockage
  et sa recherche.
- **Edge cases agents must try :** relancer après avoir terminé l’onboarding
  (on ne doit PAS le revoir), tuer l’app entre deux étapes puis relancer,
  « Se connecter » depuis la bienvenue, refuser la géolocalisation, mode
  « réduire les animations » (les scènes doivent se figer, pas disparaître),
  **créer un compte puis revenir** (le prénom ne doit PAS être redemandé à
  l’étape des centres d’intérêt).
- **Performance budget :** premier rendu visible < 2 s après l’écran de
  démarrage, sur un Android milieu de gamme.

> ⚠️ L’ancienne CUJ-001 décrivait l’écran « tasks » du squelette, supprimé
> depuis. Son flow (`tasks-cuj.yaml`) visait `com.yourcompany.skeleton.dev` et
> ne pouvait plus passer : il a été retiré plutôt que laissé rouge.

## CUJ-002 — (retirée)

> ⚠️ L’ancienne CUJ-002 décrivait « La Chasse » : coffre du jour, missions,
> mini-jeux, trophées, classement. Ni le CDC V1.0 ni la V1.1 ne décrivent cette
> gamification, et les mini-jeux sont un lot séparé, hors du pilote (V1.1). Le
> parcours et son flow (`chasse-cuj.yaml`) ont été retirés le 03/10/2026 plutôt
> que laissés rouges. Le code reste sous l’étiquette git
> `archive/mini-jeux-pre-v1.1`. Le parcours de découverte des offres Flash
> (accueil, tri par urgence, ajout au panier) aura sa propre CUJ avec les
> nouvelles maquettes.

## CUJ-003 — La boucle du commerçant

- **Owner :** squad produit TK LINK
- **Flow :** `.maestro/flows/commercant-cuj.yaml`
- **Journey :** s’inscrire comme commerçant → publier une vente flash (quota du
  §9, commission du §21 affichée avant validation) → la retrouver sur l’accueil
  client → la commander → la traiter dans « Commandes reçues » (machine à états
  du §11) → le ticket apparaît dans le portefeuille du client, convertible en
  facture certifiée (§14).
- **Edge cases agents must try :** publier avec un prix flash supérieur au prix
  initial (refus, sans publication), épuiser les cinq opérations gratuites (le
  bouton se verrouille, message sans prix : les packs ne sont pas tarifés), retirer une offre déjà
  commandée, annuler une commande après paiement (elle ne doit produire AUCUN
  ticket), passer une commande en « prête » puis attendre — la simulation ne
  doit pas écraser la décision du commerçant.
- **Performance budget :** publication < 500 ms entre le tap et l’offre visible
  sur l’accueil, sur un Android milieu de gamme.

## CUJ-004 — Le parcours du commerçant (approvisionnement)

- **Owner :** squad produit TK LINK
- **Flow :** aucun — parcours couvert par les tests d’intégration
  (`merchant/__tests__/wholesale.test.tsx`, `purchases-screen.test.tsx`) en
  attendant un flow dédié.
- **Journey :** s’inscrire comme commerçant → l’accueil montre les LOTS des
  grossistes (et non les invendus des confrères) → commander un lot → le
  retrouver dans « Mes achats » → le compte renvoie vers l’espace pro web pour
  vendre. La barre du bas n’a que trois onglets, sans favoris.
- **Edge cases agents must try :** commander SANS SIRET (bloqué, §5, avec le
  chemin pour le renseigner), commander plus que le stock, ouvrir l’écran avec
  un compte consommateur (les lots ne doivent pas être accessibles).
- **Performance budget :** aucun seuil spécifique — écran de liste simple.

## CUJ-005 — Après la commande (client)

- **Owner :** squad produit TK LINK
- **Flow :** aucun — couvert par `shop/__tests__/order-feedback.test.tsx`,
  `loyalty/__tests__/rewards.test.tsx`, `referral/__tests__/referral.test.tsx`.
- **Journey :** commande terminée → noter le commerçant (étoiles + tags) →
  signaler un problème (point d’entrée unique : remboursement ou file Super
  Admin) → récompenses débloquées (QR, partage) → parrainage (5 € déduits).
- **Edge cases agents must try :** « je n’ai rien reçu » après la remise (file
  admin, jamais remboursement direct), noter deux fois, partager puis utiliser
  la même récompense, saisir son propre code de parrainage.

## CUJ-006 — Le livreur (TK Deliver)

- **Owner :** squad produit TK LINK
- **Flow :** aucun — couvert par `courier/__tests__/courier.test.tsx`.
- **Journey :** « Devenir livreur » → inscription → justificatifs → vérification
  (simulée en démo) → biométrie → en ligne → accepter une mission → code de remise
  donné par le commerçant → livraison avec preuve photo → revenus.
- **Edge cases agents must try :** mauvais code de remise, remise sans preuve,
  passer hors ligne en pleine mission, gain affiché « dès 3,00 € » tant que la
  zone de base n’est pas définie.

## Template for new CUJs

```
## CUJ-NNN — <name>
- Owner / Flow / Journey / Edge cases / Performance budget
```

Keep this list short (≤ 10) — if everything is critical, nothing is.
