# Critical User Journeys

The flows that must never break. Every entry has: an owner, a Maestro flow
(deterministic gate), and agentic QA coverage (exploratory). Changing a CUJ's
behavior requires updating this file + its flow in the same PR (QA persona
enforces).

## CUJ-001 — Premier lancement

- **Owner :** squad produit TK LINK
- **Flow :** `.maestro/flows/smoke.yaml`
- **Journey :** ouvrir l’app → écran de bienvenue → « Passer » → onboarding
  (rôle, avatar, prénom, centres d’intérêt) → « Continuer sans compte » →
  l’accueil affiche le déstockage et sa recherche.
- **Edge cases agents must try :** relancer après avoir terminé l’onboarding
  (on ne doit PAS le revoir), tuer l’app entre deux étapes puis relancer,
  « Se connecter » depuis la bienvenue, refuser la géolocalisation, mode
  « réduire les animations » (les scènes doivent se figer, pas disparaître).
- **Performance budget :** premier rendu visible < 2 s après l’écran de
  démarrage, sur un Android milieu de gamme.

> ⚠️ L’ancienne CUJ-001 décrivait l’écran « tasks » du squelette, supprimé
> depuis. Son flow (`tasks-cuj.yaml`) visait `com.yourcompany.skeleton.dev` et
> ne pouvait plus passer : il a été retiré plutôt que laissé rouge.

## CUJ-002 — La boucle de la chasse

- **Owner:** squad produit TK LINK
- **Flow:** `.maestro/flows/chasse-cuj.yaml`
- **Journey:** ouvrir l’app → onglet du milieu « La Chasse » → ouvrir le
  coffre du jour (points + XP + coupon crédités, une seule fois par jour
  civil) → attraper un invendu du rail « Dernière chance » (panier +
  mission `catch`) → lancer un mini-jeu depuis le rail et en ressortir sur le
  hub → trophées et classement visibles en bas d’écran.
- **Edge cases agents must try:** rouvrir le coffre après un aller-retour
  d’onglet (doit rester fermé), tuer l’app juste après l’ouverture du coffre
  puis relancer (récompense persistée, pas de second tirage), attraper un
  invendu à stock 0 (bouton inerte), lancer un jeu quand le catalogue est
  filtré au point de vider les réservoirs (tuiles verrouillées, pas de
  plantage), passer minuit avec l’app ouverte.
- **Performance budget:** le hub s’affiche en < 500 ms après le tap sur
  l’onglet, sur un Android milieu de gamme ; les rails défilent à 60 fps.

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
  bouton se verrouille, les packs apparaissent), retirer une offre déjà
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
  vendre. La barre du bas n’a que trois onglets : ni favoris, ni Chasse.
- **Edge cases agents must try :** commander SANS SIRET (bloqué, §5, avec le
  chemin pour le renseigner), commander plus que le stock, ouvrir l’écran avec
  un compte consommateur (les lots ne doivent pas être accessibles).
- **Performance budget :** aucun seuil spécifique — écran de liste simple.

## Template for new CUJs

```
## CUJ-NNN — <name>
- Owner / Flow / Journey / Edge cases / Performance budget
```

Keep this list short (≤ 10) — if everything is critical, nothing is.
