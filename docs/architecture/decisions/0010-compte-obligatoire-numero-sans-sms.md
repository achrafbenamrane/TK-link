# ADR-0010 — Compte obligatoire, numéro associé sans SMS, e-mails par Resend, Apple sur Android

- **Status:** accepted
- **Date:** 2026-10-24
- **Deciders:** Achraf (développement), demande du client TK LINK
- **Supersedes:** [ADR-0009](0009-authentification.md), décisions 1 (numéro confirmé par SMS), 3 (Apple
  sur iPhone seulement) et 4 (pas de connexion obligatoire) ; décision 2 en partie (un retour par
  lien existe désormais : Apple sur Android)

## Context

Le client, le 24/10/2026 : on ne parcourt plus l’app sans compte ; les e-mails partent par
**Resend** ; le numéro sert à se connecter **sans vérification par code** pour l’instant (**Prelude**
viendra ensuite) ; le **grossiste** s’inscrit avec toutes les options ; **Apple** aussi, avec le
compte Apple de Progix — donc sur Android.

Ce que le serveur impose (code source de Supabase Auth, vérifié) : une connexion par numéro exige le
fournisseur « Phone » activé **et** un numéro confirmé (`phone_confirmed_at`) ; le tableau de bord
n’active « Phone » qu’avec un fournisseur de SMS ou un crochet « Send SMS » ; l’API
d’administration confirme un numéro sans SMS mais ne vérifie pas les doublons. Apple n’a pas de
fenêtre native sur Android. L’app n’a pas de domaine vérifié (SEC-AUTH-002). L’App Store
déconseille d’imposer un compte quand l’essentiel de l’app n’en a pas besoin (5.1.1).

## Decision

1. **Compte obligatoire.** Une seule porte d’entrée, `decideEntry` (règle pure, testée) : sans
   session, seuls le logo animé, le choix du profil, l’inscription, la connexion et le mot de passe
   oublié s’ouvrent. Connecté, on passe par les étapes d’accueil du profil, dont le type vient du
   serveur (`syncProfile`).
2. **Le numéro est associé sans code** par la fonction Edge `link-phone` : JWT, adresse e-mail
   confirmée, un seul numéro par compte, cinq numéros différents par 24 heures, doublon vérifié avant
   d’écrire, puis `updateUserById({ phone, phone_confirm: true })`. On se connecte ensuite avec ce
   numéro et le même mot de passe. `profiles.phone_verified` reste **faux** : il est réservé à une
   vraie vérification (Prelude).
3. **Aucun SMS ne part** : le crochet « Send SMS » pointe vers `public.send_sms_disabled`, qui refuse
   tout envoi. Le fournisseur « Phone » est activé, ses confirmations **aussi** : une inscription par
   téléphone, une connexion par code ou un changement de numéro sans preuve échouent donc.
4. **Mot de passe oublié par e-mail seulement** jusqu’à Prelude.
5. **E-mails par Resend** (SMTP `smtp.resend.com:465`, utilisateur `resend`, clé d’API), réglés
   dans le tableau de bord du projet hébergé, depuis une adresse d’un domaine vérifié chez Resend.
6. **Apple sur Android par sa page web** : `signInWithOAuth` (PKCE en S256 — un `digest` SHA-256
   fourni par expo-crypto), onglet du navigateur du système (`expo-web-browser`), retour sur
   `tklink://auth/callback` (entrée exacte), `exchangeCodeForSession`. Exception à SEC-AUTH-002
   acceptée : avec PKCE, un code intercepté ne sert à rien sans le vérificateur resté sur
   l’appareil (RFC 8252 §8.1). Sur iPhone, la feuille native reste.
7. **Le type de compte se déclare une fois** (`declare_account_type`) quand l’inscription passe par
   Google ou Apple, qui ne transmettent pas nos métadonnées. Une déclaration, pas un droit — et un
   geste d’INSCRIPTION : se connecter ne déclare rien. Le type déclaré est relu à la connexion et au
   lancement (`syncProfile`) ; les données locales d’un autre compte sont remises à zéro.
8. **Le grossiste peut s’inscrire avec Google ou Apple** (le client et le livreur aussi) : sa fiche
   (entreprise, catégorie, adresse, SIRET, modes, numéro de contact) reste obligatoire. Le commerçant
   s’inscrit par e-mail, comme sur sa maquette (l’encart des opérations offertes à la place).
9. **Démonstration** : la session locale est conservée sur téléphone (stockage sécurisé) pour que la
   build de démonstration ne demande pas de se reconnecter à chaque ouverture.

## Consequences

- Positive : une entrée unique et testée ; la connexion par numéro ne coûte aucun SMS ; Prelude se
  branchera sans refonte (crochet « Send SMS » ou fonctions Edge, `phone_verified`).
- Negative / accepted trade-offs :
  - un numéro n’est **pas prouvé** : quelqu’un peut associer celui d’un autre, qui verra alors
    « déjà associé ». Parades : un numéro par compte, cinq numéros essayés par jour, le support peut le
    détacher ; Prelude le vérifiera. Le refus d’un numéro pris dit qu’il a un compte : exception
    **bornée** à SEC-AUTH-003 (cinq numéros différents par compte et par jour ; réessayer le même ne compte pas) ;
  - sans compte, une inscription par téléphone répond différemment pour un numéro associé et pour un
    numéro libre : des numéros peuvent être testés au rythme des limites d’Auth par adresse IP.
    Prelude ou un CAPTCHA d’Auth fermeront cette porte ;
  - l’App Review peut objecter au compte obligatoire (5.1.1) : fournir un compte de démonstration
    dans les notes de soumission ;
  - le secret Apple (JWT signé avec la clé `.p8`) expire au bout de six mois : à renouveler ;
  - les trois variantes de l’app partagent le schéma `tklink` : si plusieurs sont installées, le
    retour d’Apple peut ouvrir la mauvaise, et l’échange échoue alors sans risque ;
  - Resend exige un domaine vérifié : `tklink.fr` n’est pas enregistré aujourd’hui ;
  - `supabase config push` est dangereux pour l’authentification (la CLI inverse la confirmation des
    SMS et coupe la connexion par numéro) : le projet hébergé se règle dans le tableau de bord.
- Enforcement : `gate.test.ts` et les tests du service, du store et des écrans ; pgTAP
  (`phone_verified` jamais déduit d’Auth, type déclaré une fois, `phone_is_taken` et le compteur
  réservés au serveur, crochet réservé à Auth) ; `npm run auth:check` (confirmations désactivées,
  migration 0008 absente ou `link-phone` non déployée = bloquant).

## Alternatives considered

- **`updateUser({ phone })` côté client, confirmations désactivées** — n’importe qui créerait un
  compte par téléphone, session immédiate, et changerait de numéro sans preuve.
- **Un déclencheur qui écrit `auth.users.phone`** — le schéma d’Auth ne se modifie pas, aucune
  identité « phone » n’est créée, et un doublon ferait échouer l’inscription elle-même.
- **Prelude tout de suite** — le client le veut plus tard ; l’architecture est prête.
- **Un lien vérifié (`https://…/auth/callback`) pour le retour d’Apple** — pas de domaine vérifié
  aujourd’hui, et le retour d’un onglet vers un lien https n’est pas garanti : à reprendre avec le
  domaine.
- **Pas d’Apple sur Android** — c’était ADR-0009 ; le client le veut.
