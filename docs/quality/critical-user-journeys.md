# Critical User Journeys

The flows that must never break. Every entry has: an owner, a Maestro flow
(deterministic gate), and agentic QA coverage (exploratory). Changing a CUJ's
behavior requires updating this file + its flow in the same PR (QA persona
enforces).

## CUJ-001 — Premier lancement

- **Owner :** squad produit TK LINK
- **Flow :** `.maestro/flows/smoke.yaml`
- **Journey :** ouvrir l’app → logo animé → choix du profil → **inscription
  (le compte est obligatoire, ADR-0010)** → étapes d’accueil du profil (centres
  d’intérêt ou dossier pro) → l’accueil affiche le déstockage et sa recherche.
  Trois profils au choix : client, commerçant, grossiste (le livreur a été
  retiré le 13/11/2026, voir CUJ-006).
- **Edge cases agents must try :** aucun écran de l’app n’est joignable sans
  compte (ni par le bouton retour, ni par un lien) ; relancer connecté (logo
  puis accueil directement, sans revoir le choix du profil) ; tuer l’app entre
  deux étapes puis relancer (on reprend l’étape d’accueil, pas l’inscription) ;
  « J’ai déjà un compte » depuis l’inscription ; se déconnecter (logo, puis
  choix du profil) ; refuser la géolocalisation ; mode « réduire les
  animations » (les scènes doivent se figer, pas disparaître) ; **créer un
  compte puis revenir** (le prénom ne doit PAS être redemandé).
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
  facture certifiée (§14). En **livraison** : « C’est prêt » → « Remise au
  coursier » (écran `remise/[id]`, coursier partenaire Uber Direct) → « En
  livraison » → « Livrée ». En **Touch & Collect** : « C’est prêt » → « Remise
  au client » → « Récupérée ».
- **Edge cases agents must try :** publier avec un prix flash supérieur au prix
  initial (refus, sans publication), épuiser les cinq opérations gratuites (le
  bouton se verrouille, message sans prix : les packs ne sont pas tarifés), retirer une offre déjà
  commandée, annuler une commande après paiement (elle ne doit produire AUCUN
  ticket), passer une commande en « prête » puis attendre — la simulation ne
  doit pas écraser la décision du commerçant ; ouvrir la remise au coursier
  d’une commande pas encore prête, ou d’un Touch & Collect (refusée par la
  machine à états).
- **Performance budget :** publication < 500 ms entre le tap et l’offre visible
  sur l’accueil, sur un Android milieu de gamme.

## CUJ-004b — Le parcours du grossiste / fournisseur (le commerçant passe par le même dossier pro, étapes 3 à 6)

- **Owner :** squad produit TK LINK
- **Flow :** aucun — couvert par `merchant/__tests__/wholesaler.test.tsx`.
- **Journey :** s’inscrire comme grossiste → déposer son dossier (SIRET, adresse, IBAN, pièce d’identité)
  → vérification TK LINK → sécurisation de l’appareil → compte validé → tableau de bord fournisseur →
  créer une offre pro (prix grossiste, minimum, durée) → recevoir une commande de commerçant → cocher
  le bon de préparation → expédier → livrer → terminer.
- **Edge cases agents must try :** publier avant validation (bloqué), expédier sans bon de préparation
  coché (bloqué), IBAN à clé fausse (refusé).
- **Performance budget :** aucun seuil spécifique — écrans de liste.

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

## CUJ-006 — (retirée) Le livreur (TK Deliver)

> ⚠️ Décision du 13/11/2026 : les livraisons sont confiées à **Uber Direct**, commandé par le
> serveur. TK LINK n’a plus de livreurs à lui : le rôle livreur, son inscription (FranceConnect,
> selfie), ses onglets (Missions, Carte, Messages), ses missions et ses codes de remise ont été
> retirés de l’app. Le code reste dans l’historique git (avant la suppression de
> `src/features/courier/`). Un ancien compte livreur se relit en compte client, sans perdre son
> profil (`onboarding/__tests__/rehydration.test.ts`). Ce que voit le commerçant au départ d’une
> livraison est dans CUJ-003 ; le suivi Uber Direct aura sa CUJ quand l’intégration existera.

## CUJ-007 — Compte : inscription, connexion, mot de passe oublié

- **Owner :** squad produit TK LINK
- **Flow :** aucun — couvert par `auth/__tests__/` (écrans, store, service) ; à dérouler sur téléphone
  avec un projet Supabase branché (`npm run auth:check` d’abord).
- **Journey :** créer un compte par e-mail avec un numéro → saisir le code reçu (envoyé par Resend) →
  le numéro s’associe tout seul → se déconnecter → se reconnecter **avec le numéro** et le même mot de
  passe → « Mot de passe oublié » (e-mail) → code → nouveau mot de passe → « Continuer avec Google »
  (Android et iPhone) → « Continuer avec Apple » (iPhone : feuille native ; Android : page d’Apple) →
  inscription **grossiste** avec Google ou Apple (fiche pro remplie) → réinstaller l’app, se
  reconnecter : on retrouve l’espace grossiste → Profil → « Mon compte » → « Supprimer mon compte ».
- **Edge cases agents must try :** mauvais code puis bon code, code expiré, « Renvoyer le code » avant
  la fin du délai (bloqué), adresse déjà inscrite, numéro déjà associé à un autre compte (message
  clair, on entre quand même avec l’e-mail), six numéros différents essayés dans la journée (le sixième
  est refusé), un numéro tapé au mot de passe oublié (« par SMS, bientôt »), fenêtre Google ou page
  Apple fermée (aucune erreur), réseau coupé pendant la connexion, Apple qui ne redonne pas le nom à
  la seconde connexion, grossiste avec Google sans SIRET (refusé avant d’ouvrir Google).
- **À vérifier sur téléphone, pas en navigateur :** les fenêtres Google et Apple, le retour de la page
  Apple vers l’app (Android), la session qui survit à la fermeture de l’app.

## CUJ-008 — Écrire au support TK LINK

- **Flow :** aucun — couvert par `support/__tests__/` ; à dérouler sur téléphone avec la migration
  `0014_support` appliquée et le back-office relié (`landing/DEPLOY.md`).
- **Journey :** Profil → « Aide et support » → « Nouvelle demande » → choisir « Une commande », un
  sujet, un message → « Envoyer à TK LINK » → la conversation s’ouvre (« Bien reçu ») → dans
  `/admin` → Messages, la demande est en tête (sans réponse) → répondre → sur le téléphone, la
  réponse arrive en direct, signée « Équipe TK LINK », la demande passe « En cours » → « Marquer
  résolu » puis « Fermer » dans `/admin` : l’app ne propose plus de répondre.
- **Edge cases agents must try :** sujet de deux lettres (refusé), message vide, six demandes dans
  la journée (la sixième est refusée, message clair), réseau coupé à l’envoi, serveur sans la
  migration (« pas encore activé »), un client puis un commerçant (chacun ne voit que ses demandes).

## Template for new CUJs

```
## CUJ-NNN — <name>
- Owner / Flow / Journey / Edge cases / Performance budget
```

Keep this list short (≤ 10) — if everything is critical, nothing is.
