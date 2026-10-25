---
read-when: 'Avant de toucher à la connexion, à l’inscription, au mot de passe, à Google ou Apple, ou de configurer Supabase Auth'
owns: 'Le fonctionnement de l’authentification de TK LINK et sa mise en service, console par console'
---

# Authentification

Décisions et alternatives : [ADR-0009](../architecture/decisions/0009-authentification.md), puis
[ADR-0010](../architecture/decisions/0010-compte-obligatoire-numero-sans-sms.md) (compte obligatoire,
numéro sans SMS, Resend, Apple sur Android). Journal du chantier :
[exec plan du 24/10/2026](../architecture/exec-plans/2026-10-24-authentification.md).

## Ce que fait l’app

| Méthode                      | Parcours                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Compte obligatoire           | Sans session : logo animé, choix du profil, inscription, connexion, mot de passe oublié. Rien d’autre (`decideEntry`).         |
| E-mail + mot de passe        | Inscription → **code à 6 chiffres** reçu par e-mail (envoyé par **Resend**) → session.                                         |
| Téléphone + mot de passe     | Le numéro saisi à l’inscription est **associé au compte sans code** (fonction Edge `link-phone`), puis sert à se connecter.    |
| Connexion                    | Un seul champ « E-mail ou téléphone » : l’app devine lequel (`parseIdentifier`) et normalise (E.164).                          |
| Mot de passe oublié          | Par **e-mail** seulement : code (`recovery`) → nouveau mot de passe → connecté. Par SMS : avec Prelude.                        |
| Google                       | Fenêtre **native** de Google → jeton d’identité → Supabase (`signInWithIdToken`). Android et iOS.                              |
| Apple                        | iPhone : feuille **native**, nonce haché. Android : **page web d’Apple** dans le navigateur du système, avec PKCE.             |
| Sans serveur (démonstration) | Sans `EXPO_PUBLIC_SUPABASE_*`, tout est simulé sur le téléphone ; le code est `123456` ; la session est conservée (téléphone). |

- **Client, grossiste et livreur s’inscrivent par e-mail, Google ou Apple.** Le **commerçant**
  s’inscrit par e-mail : sa maquette montre, à la place de Google et Apple, l’encart des opérations
  Flash offertes. Un professionnel remplit toujours sa fiche (entreprise, catégorie, adresse, SIRET,
  modes, numéro de contact) ; avec Google ou Apple, il n’a ni mot de passe à inventer ni e-mail à
  recopier. Le numéro tapé devient un contact du compte, puis il est associé.
- **Le type de compte** (client, commerçant, grossiste, livreur) se déclare à l’INSCRIPTION : dans
  les métadonnées par e-mail, par `declare_account_type` (une seule fois) avec Google ou Apple.
  Se connecter ne déclare rien : un compte créé par Google ou Apple depuis l’écran de connexion est
  un compte client. Sur un nouvel appareil, l’app relit le type déclaré (`syncProfile`) avant de
  choisir l’accueil — à la connexion, et à chaque lancement tant que l’accueil n’est pas fini.
- **L’accueil est retenu par le compte** (`profiles.onboarded_at`, `interests`, migration 0009) :
  une personne déjà inscrite qui se reconnecte — après une déconnexion, sur un autre appareil, ou
  après un nouveau mot de passe — entre directement dans l’app, avec ses centres d’intérêt.
- **Les données locales appartiennent à un compte** : si un AUTRE compte se connecte sur l’appareil
  (session expirée sans déconnexion), le profil, le panier, les commandes et la fidélité du précédent
  repartent de zéro.
- **Le numéro est facultatif pour un client** (l’e-mail suffit) et obligatoire pour un commerçant,
  un grossiste ou un livreur, qui doivent être joignables. L’inscription par numéro SEUL viendra avec
  Prelude, quand un code SMS pourra prouver qu’il appartient à la personne.
- **Le numéro n’est jamais bloquant** : s’il est déjà pris ou si le réseau lâche, l’app le dit et
  laisse entrer avec l’e-mail. Il se rattache aussi à la connexion suivante, ou depuis « Mon compte ».
- **Le numéro n’est pas vérifié** (aucun SMS avant Prelude) : il est « associé ».
  `profiles.phone_verified` reste faux jusqu’à une vraie vérification.
- **Pourquoi des codes et pas des liens** : un lien doit rouvrir l’app par un lien vérifié
  (SEC-AUTH-002) et se casse quand la messagerie le précharge ; un code se recopie.

## Où est le code

- `src/features/auth/model/` — `gate.ts` (la porte d’entrée), `identifier.ts` (e-mail ou téléphone,
  E.164), `auth-errors.ts` (catégories, messages français), `service.ts` (chaque appel à Supabase),
  `store.ts` (état, démonstration, `syncProfile`), `social/google.ts`, `social/apple.ts`,
  `account.ts`.
- `src/features/auth/ui/` — connexion, inscription (+ `sign-up-verification.tsx`), `code-step.tsx`,
  `forgot-password-screen.tsx`, `account-screen.tsx`, `social-buttons.tsx`.
- `src/app/_layout.tsx` (`EntryGate`), `src/app/sign-in.tsx` (`useEnterApp`), `src/app/+native-intent.tsx`
  (le retour d’Apple sur Android n’est pas une navigation).
- `supabase/migrations/0007_auth_identity.sql` et `0008_phone_link_account_type.sql` — le profil,
  le type déclaré une fois, le compteur de tentatives, le crochet « Send SMS ».
- `supabase/functions/link-phone/` — associe un numéro sans code ; `delete-account/` — suppression.
- `supabase/config.toml` (`[auth]`) et `supabase/templates/` — réglages de référence et e-mails.
- `scripts/check-auth-config.mjs` (`npm run auth:check`) et `scripts/apple-client-secret.mjs`
  (`npm run apple:secret`).

## Mise en service — dans cet ordre

Tout se règle dans le **tableau de bord** du projet hébergé. Ne pas pousser la section `[auth]` avec
`supabase config push` : la CLI coupe la connexion par numéro faute de fournisseur de SMS, et envoie
« confirmations SMS » à l’envers.

### 1. Supabase

1. **Projet** : en créer un (région UE, Paris de préférence), noter sa référence (`<ref>`).
2. **Base et fonctions** : `npx supabase login`, `npx supabase link --project-ref <ref>`,
   `npx supabase db push` (migrations `0001` → `0009`), puis
   `npx supabase functions deploy delete-account` et `npx supabase functions deploy link-phone`.
   Sans la CLI : SQL Editor (les fichiers de migration l’un après l’autre, dans l’ordre) et Edge
   Functions → Deploy a new function → Via Editor. Pour les deux fonctions, **Verify JWT with
   legacy secret** reste DÉSACTIVÉ : elles vérifient l’appelant elles-mêmes, et ce contrôle
   refuserait les sessions signées avec les nouvelles clés JWT du projet.
3. **Authentication → Providers → Email** : activé, **Confirm email** activé (obligatoire :
   `link-phone` n’associe un numéro qu’à une adresse confirmée), longueur minimale 8, et **Email
   OTP Length = 6** : les projets récents envoient 8 chiffres par défaut, et l’app en attend 6.
4. **Authentication → Emails → Templates** : coller `supabase/templates/confirmation.html` dans
   « Confirm signup » et `recovery.html` dans « Reset password ». Ils contiennent `{{ .Token }}` :
   c’est le code que l’app demande. Sans lui, l’e-mail n’a qu’un lien et l’app attend en vain.
5. **Authentication → Hooks → Send SMS** : type **Postgres**, fonction `public.send_sms_disabled`.
   Elle refuse tout envoi : personne ne crée de compte par téléphone ni ne change de numéro sans
   preuve. Avec Prelude, ce crochet pointera vers Prelude.
6. **Authentication → Providers → Phone** : activer, et laisser **Enable phone confirmations**
   ACTIVÉ (aucun SMS ne part : le crochet le refuse). Le crochet dispense de fournisseur de SMS.
   Pas de « Test phone numbers » : ils contournent le crochet.
7. **Authentication → URL Configuration** : Site URL = le site TK LINK ; **Redirect URLs** : ajouter
   exactement `tklink://auth/callback` (le retour d’Apple sur Android). `tklink://` seul ne suffit
   pas : Supabase renverrait sans rien dire vers le Site URL.
8. **Project Settings → API** : l’URL du projet et la clé **anon** (publique) vont dans les variables
   d’environnement (étape 5). **Jamais** la clé `service_role`.

### 2. Resend (les e-mails)

1. **Un domaine à soi** : Resend n’envoie que depuis un domaine vérifié. `tklink.fr` n’est **pas
   enregistré** aujourd’hui : l’acheter (ou choisir le domaine réel) d’abord.
2. **Resend → Domains → Add Domain** : un sous-domaine, par ex. `auth.tklink.fr`, région
   `eu-west-1`. Ajouter chez l’hébergeur DNS exactement les enregistrements affichés (DKIM
   `resend._domainkey…`, SPF/retour `send…` — MX + TXT, ou deux CNAME selon ce que Resend montre),
   puis un DMARC (`_dmarc.tklink.fr`, `v=DMARC1; p=none;` pour commencer). Vérifié en 15 min à 72 h.
   Désactiver le suivi des ouvertures et des clics.
3. **Brancher Supabase** — au choix :
   - **Resend → Settings → Integrations → Connect to Supabase** : choisir le projet et le domaine ;
     Resend crée la clé et remplit le SMTP de Supabase ;
   - ou **Authentication → Emails → SMTP Settings** : activer, hôte `smtp.resend.com`, port `465`,
     utilisateur `resend`, mot de passe = une clé Resend « Sending access », expéditeur
     `no-reply@auth.tklink.fr` (EXACTEMENT sur le domaine vérifié), nom « TK LINK ».
4. **Authentication → Rate Limits** : relever « emails per hour » (30 par défaut une fois le SMTP
   branché) sans dépasser le forfait Resend (gratuit : 100 par jour, 3 000 par mois).
5. **Apple → Sign in with Apple for Email Communication** : déclarer le domaine d’envoi et son
   sous-domaine de retour, sinon les e-mails vers les adresses relais d’Apple
   (`…@privaterelay.appleid.com`) n’arrivent pas.

### 3. Google Cloud Console

1. **Écran de consentement OAuth** : type Externe, nom « TK LINK », e-mail d’assistance, logo, domaine,
   champs d’application `openid`, `email`, `profile`. Le publier.
2. **Identifiants → Créer un ID client OAuth**, trois fois :
   - **Application Web** → son identifiant est `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, son **secret** va
     dans Supabase (jamais dans l’app). C’est le destinataire (`aud`) du jeton que Supabase vérifie.
   - **Android**, une fois par variante (`com.progix.tklink`, `com.progix.tklink.preview`,
     `com.progix.tklink.dev`) avec l’**empreinte SHA-1** de la clé de signature :
     `npx eas-cli credentials -p android` → profil voulu → « SHA1 Fingerprint ». En production sur le
     Play Store, ajouter aussi la SHA-1 de la clé d’app (Play Console → Intégrité de l’app).
   - **iOS** pour `com.progix.tklink` (et les variantes à tester) → `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.
     Le schéma de retour iOS (`com.googleusercontent.apps.…`) est déduit tout seul dans
     `app.config.ts`.
3. **Supabase → Providers → Google** : activer ; **Client IDs** = identifiant Web **en premier**, puis
   iOS et Android, séparés par des virgules ; **Client Secret** = secret du client Web ;
   « Skip nonce checks » désactivé (voir le dépannage si iOS se plaint du nonce). Sur Android, le jeton
   porte l’identifiant **Web** comme destinataire : l’identifiant Android n’est pas indispensable ici.
4. Tant que l’écran de consentement est **en test**, seuls les comptes ajoutés dans **Audience → Test
   users** peuvent se connecter.

> **État au 25/10/2026 (comptes de test, à transférer au client)** : projet Google Cloud « TK LINK »
> (`tk-link-512715`), client Web `188076300528-nk5gpqajhiqe721pmpsm08ju4pdv8mrr`, client Android
> `com.progix.tklink.preview` `188076300528-nif7noenbvhheliu0f0bvprtkdsohroo` (SHA-1 de la clé EAS du
> profil `preview`). `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` est posée dans l’environnement EAS `preview`.
> Restent : clients Android `com.progix.tklink` et `.dev`, client iOS, publication de l’écran de
> consentement. Le transfert au client se fait en l’ajoutant **Owner** du projet (IAM), ou en recréant
> les clients sur son compte — les identifiants changent alors, ainsi que la variable EAS.

### 4. Apple (compte développeur Progix)

1. **Identifiers → App IDs** : pour `com.progix.tklink` (et `.preview`, `.dev` si on les teste),
   cocher **Sign In with Apple** (« Enable as a primary App ID » sur `com.progix.tklink`). EAS
   synchronise aussi la capacité au premier build iOS.
2. **Identifiers → + → Services IDs** : par ex. `com.progix.tklink.web` → Sign in with Apple →
   Configure : Primary App ID `com.progix.tklink` ; **Domain** `<ref>.supabase.co` (sans `https://`) ;
   **Return URL** `https://<ref>.supabase.co/auth/v1/callback`. Aucun fichier de vérification.
3. **Keys → +** : Sign in with Apple, même App ID principal → télécharger `AuthKey_<KEYID>.p8` (une
   seule fois ! deux clés au plus). Noter le **Key ID** et le **Team ID**.
4. **Le secret** (pour Android) : `npm run apple:secret -- <TEAM_ID> <KEY_ID> com.progix.tklink.web
<chemin/AuthKey_KEYID.p8>`. Il expire au bout de **180 jours** : noter la date, refaire avant.
   Ni la clé ni le secret ne vont dans le dépôt.
5. **Supabase → Providers → Apple** : activer ; **Client IDs** =
   `com.progix.tklink.web,com.progix.tklink,com.progix.tklink.preview,com.progix.tklink.dev` — le
   **Services ID en premier** (la page web l’utilise ; l’iPhone accepte n’importe lequel) ;
   **Secret Key** = le secret de l’étape 4.
6. Build iOS avec le compte Apple de Progix : `npx eas-cli build -p ios --profile preview`. Android :
   un nouveau build aussi (module `expo-web-browser`).

Un même compte Apple ouvre le même compte TK LINK sur iPhone et sur Android (l’identifiant Apple est
commun à toute l’équipe Progix). Apple ne donne le nom qu’à la toute première connexion. Sur Android,
toute la connexion (double authentification comprise) doit tenir en 5 minutes.

### 5. Variables d’environnement

À créer dans EAS pour **preview** et **production** (expo.dev → projet → Environment variables, ou
`npx eas-cli env:create`), et dans le `.env` local :

| Variable                           | Valeur                                               |
| ---------------------------------- | ---------------------------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`         | URL du projet Supabase                               |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY`    | clé **anon** (publique)                              |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | client OAuth « Application Web »                     |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | client OAuth « iOS »                                 |
| `EXPO_PUBLIC_AUTH_PHONE`           | `on` (défaut) ; `off` masque la connexion par numéro |

⚠️ Dès que les deux variables Supabase existent, la build **quitte le mode démonstration** : les
comptes deviennent réels. Les écrans pré-remplis de démonstration (inscription, missions d’exemple)
restent tant que `EXPO_PUBLIC_APP_ENV` n’est pas `production`.

### 6. Vérifier

`npm run auth:check` lit le `.env` et dit, pour le vrai projet, ce qui est prêt et ce qui bloque
(fournisseurs, confirmations, migrations 0007–0009, fonction `link-phone`). Puis, sur téléphone,
dérouler [CUJ-001 et CUJ-007](../quality/critical-user-journeys.md).

## Dépannage

| Symptôme                                                        | Cause → correction                                                                                                                                                                                            |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google : `DEVELOPER_ERROR` (Android)                            | Package ou SHA-1 absent du client OAuth Android de la variante installée.                                                                                                                                     |
| Google ou Apple : « Unacceptable audience in id_token »         | L’identifiant (client Web/iOS, ou bundle Apple) manque dans « Client IDs » de Supabase.                                                                                                                       |
| Google sur iPhone : « nonce … should either both exist or not » | Activer « Skip nonce checks » pour Google dans Supabase.                                                                                                                                                      |
| Apple sur Android : l’onglet affiche le site au lieu de revenir | `tklink://auth/callback` absent des Redirect URLs, ou connexion de plus de 5 minutes (double authentification Apple comprise) : Supabase renvoie alors vers le Site URL. Fermer l’onglet, recommencer.        |
| « Phone » : le tableau de bord refuse d’enregistrer             | Crochet « Send SMS » pas encore activé (il dispense de fournisseur de SMS). Sinon : API de gestion, `PATCH /v1/projects/<ref>/config/auth` avec `{"external_phone_enabled": true, "sms_autoconfirm": false}`. |
| Apple sur Android : page d’erreur « missing OAuth secret »      | Secret Apple absent ou expiré : `npm run apple:secret`, puis le coller dans Supabase.                                                                                                                         |
| Connexion par numéro : « Phone logins are disabled »            | Fournisseur « Phone » désactivé (étape 1.6).                                                                                                                                                                  |
| Connexion par numéro refusée alors que le mot de passe est bon  | Numéro pas encore associé : « Mon compte » → « Associer ce numéro ».                                                                                                                                          |
| L’e-mail contient un lien, pas de code                          | Modèle sans `{{ .Token }}` : coller ceux de `supabase/templates/`.                                                                                                                                            |
| « L’e-mail n’a pas pu partir »                                  | Resend refuse : domaine non vérifié, expéditeur hors domaine, ou quota du forfait atteint.                                                                                                                    |
| Les e-mails n’arrivent qu’à l’équipe, ou « rate limit »         | SMTP par défaut de Supabase : brancher Resend (étape 2).                                                                                                                                                      |
| Le bouton Google n’apparaît pas                                 | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` vide dans la build.                                                                                                                                                        |

## Sécurité — ce qui est tenu

- **Session** dans `LargeSecureStore` (AES + Keychain/Keystore) ; aucun mot de passe ni jeton n’est
  journalisé ou conservé ailleurs. Déconnexion : session de cet appareil seulement (`scope: local`).
- **Google et Apple sur iPhone** : fenêtres natives et jeton signé ; Apple avec un nonce aléatoire
  (empreinte SHA-256 à Apple, nonce brut à Supabase).
- **Apple sur Android** : navigateur du système (jamais une vue web intégrée, SEC-AUTH-001), PKCE en
  S256 (un `digest` SHA-256 fourni par expo-crypto), retour `tklink://auth/callback` — un schéma
  d’app, pas un lien vérifié : exception à SEC-AUTH-002 acceptée dans l’ADR-0010, car un code
  intercepté ne s’échange pas sans le vérificateur resté sur l’appareil. Le lien de retour n’est
  jamais journalisé, et le routeur ne navigue pas dessus.
- **Anti-énumération** : « Identifiant ou mot de passe incorrect » sans distinction ; « Si un compte
  existe… » au mot de passe oublié. Exception bornée : associer un numéro déjà pris le dit — cinq
  numéros différents par compte et par 24 heures (réessayer le même ne compte pas). Limite connue :
  sans compte, `signUp({ phone })` répond différemment pour un numéro déjà associé (succès de façade)
  et pour un numéro libre (refus du crochet) — on peut donc tester des numéros sans compte, au rythme
  des limites d’Auth par adresse IP (`sign_in_sign_ups`). Prelude (code envoyé) ou un CAPTCHA d’Auth
  fermeront cette porte.
- **Numéro** : aucun chemin client ne crée ni ne confirme un numéro (crochet « Send SMS ») ;
  `link-phone` exige un e-mail confirmé, un seul numéro par compte, et vérifie les doublons.
- **Profil** : `account_type`, `account_type_declared`, `contact_phone`, `phone_verified` ne
  s’écrivent pas depuis le client (privilèges par colonne, testés en pgTAP). `account_type` est une
  **déclaration**, pas un droit, et ne se déclare qu’une fois.
- **Limites connues** (voir [quality-score](../quality/quality-score.md)) : un numéro associé n’est
  pas prouvé (Prelude) ; la révocation du jeton Apple à la suppression du compte demande la clé
  `.p8` côté serveur — à faire avant la publication iOS ; le secret Apple expire tous les six mois ;
  la protection contre les mots de passe divulgués est une option payante de Supabase ; lancée HORS
  LIGNE avec un jeton expiré, l’app ne peut pas renouveler la session et montre la connexion (elle
  entre seule dès que le réseau revient) ; la session de démonstration n’est conservée que sur
  téléphone (l’aperçu web la perd à chaque rechargement).
