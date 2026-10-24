# ADR-0009 — Authentification : e-mail ou téléphone + mot de passe, Google et Apple natifs

- **Status:** accepted — décisions 1, 3 et 4 remplacées, décision 2 en partie, par [ADR-0010](0010-compte-obligatoire-numero-sans-sms.md) (plus de fournisseur de SMS ; Apple sur Android revient par `tklink://auth/callback`)
- **Date:** 2026-10-24
- **Deciders:** Achraf (développement), demande du client TK LINK

## Context

Le client veut une connexion par **e-mail ou numéro de téléphone avec mot de passe**, et par
**Google** et **Apple** (console Google, compte développeur Apple de Progix). Le back-end est
Supabase ([ADR-0007](0007-supabase-backend.md)). Contraintes : l’App Store exige Apple dès qu’on offre
Google sur iOS (4.8) et interdit d’imposer un compte pour ce qui n’en a pas besoin (5.1.1) ; la règle
SEC-AUTH-002 réserve les retours d’authentification aux liens vérifiés, et l’app n’a pas de domaine
vérifié aujourd’hui ; le développement se fait sans Mac ni téléphone iOS.

## Decision

1. **Supabase Auth est la seule source d’identité.** E-mail et téléphone sont des identités natives
   de Supabase (`signInWithPassword({ email | phone })`). Un numéro ne sert à se connecter qu’une
   fois **confirmé par SMS** ; avant, c’est un contact (`user_metadata.contact_phone`).
2. **Codes à six chiffres, jamais de liens** pour la confirmation et le mot de passe oublié
   (`verifyOtp` : `signup`, `recovery`, `sms`, `phone_change`). Aucun retour par lien n’est donc
   nécessaire.
3. **Google et Apple par jeton d’identité natif** (`@react-native-google-signin/google-signin`,
   `expo-apple-authentication`, puis `signInWithIdToken`), sans navigateur ni redirection. Apple
   utilise un nonce (empreinte à Apple, nonce brut à Supabase) ; Apple est **iOS seulement**.
4. **Pas de connexion obligatoire.** La session est relue au démarrage ; ce qui exige un compte le
   vérifie sur place.
5. **Le mode démonstration reste** tant qu’aucun projet Supabase n’est configuré (code `123456`).
6. **Le profil est tenu par le serveur** : un déclencheur le remplit à l’inscription en validant chaque
   métadonnée ; le client ne peut modifier que son nom (privilèges par colonne).

## Consequences

- Positive : aucun secret dans l’app (identifiants OAuth publics, secret Google dans Supabase) ; aucun
  lien à vérifier ; un même parcours de code pour l’e-mail et le SMS ; les règles tiennent par tests
  (Jest pour le client, pgTAP pour la base).
- Negative / accepted trade-offs : le téléphone exige un fournisseur de SMS payant (Twilio…) — sans
  lui, `EXPO_PUBLIC_AUTH_PHONE=off` masque l’option ; trois nouveaux modules natifs imposent un
  nouveau build ; Apple n’est pas proposé sur Android ; la révocation du jeton Apple à la suppression
  du compte reste à faire côté serveur.
- Enforcement : tests Jest de `src/features/auth/__tests__/` (service, store, écrans), pgTAP de
  `supabase/tests/database/rls.test.sql` (privilèges du profil), `npm run auth:check` (projet réel).

## Alternatives considered

- **OAuth par navigateur** (`signInWithOAuth` + retour `tklink://`) — un schéma personnalisé n’est pas
  un lien vérifié (SEC-AUTH-002), et l’expérience est moins bonne que la fenêtre native.
- **Numéro comme alias d’un compte e-mail**, résolu par une fonction Edge — fonctionne sans SMS, mais
  le numéro n’est jamais prouvé, la fonction concentre les tentatives de connexion derrière une même
  adresse IP (limites de débit partagées), et ce serait une seconde source d’identité.
- **Liens magiques** pour la confirmation — cassés par le préchargement des messageries, et ils
  exigent un lien vérifié pour rouvrir l’app.
