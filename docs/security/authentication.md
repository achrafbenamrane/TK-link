---
read-when: 'Avant de toucher à la connexion, à l’inscription, au mot de passe, à Google ou Apple, ou de configurer Supabase Auth'
owns: 'Le fonctionnement de l’authentification de TK LINK et sa mise en service, console par console'
---

# Authentification

Décision et alternatives : [ADR-0009](../architecture/decisions/0009-authentification.md). Journal du
chantier : [exec plan du 24/10/2026](../architecture/exec-plans/2026-10-24-authentification.md).

## Ce que fait l’app

| Méthode                      | Parcours                                                                                                    |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- |
| E-mail + mot de passe        | Inscription → **code à 6 chiffres** reçu par e-mail (si la confirmation est active) → session.              |
| Téléphone + mot de passe     | Le numéro saisi à l’inscription est d’abord un **contact**. Vérifié par **SMS**, il devient un identifiant. |
| Connexion                    | Un seul champ « E-mail ou téléphone » : l’app devine lequel (`parseIdentifier`) et normalise (E.164).       |
| Mot de passe oublié          | Code par e-mail (`recovery`) ou par SMS → nouveau mot de passe → connecté.                                  |
| Google                       | Fenêtre **native** de Google → jeton d’identité → Supabase (`signInWithIdToken`). Android et iOS.           |
| Apple                        | Feuille **native** d’Apple, **iOS seulement**, avec nonce haché → Supabase.                                 |
| Sans serveur (démonstration) | Sans `EXPO_PUBLIC_SUPABASE_*`, tout est simulé sur le téléphone ; le code de démonstration est `123456`.    |

- **Pas de connexion obligatoire** : l’app se parcourt sans compte (App Store 5.1.1). La session est
  relue au démarrage (`AuthBootstrap` dans `src/app/_layout.tsx`).
- **Pourquoi des codes et pas des liens** : un lien doit rouvrir l’app par un lien vérifié
  (SEC-AUTH-002) et se casse quand la messagerie le précharge ; un code se recopie, et marche pareil
  pour un e-mail et un SMS.
- **Le numéro n’est jamais bloquant** : après l’inscription, « Vérifier mon numéro » se propose avec
  « Plus tard ». Une panne du fournisseur de SMS n’empêche personne d’entrer avec son e-mail.
- **Commerçants et grossistes** s’inscrivent par e-mail (fiche professionnelle) ; Google et Apple sont
  proposés aux particuliers et aux livreurs, et à tous sur l’écran de connexion.

## Où est le code

- `src/features/auth/model/` — `identifier.ts` (e-mail ou téléphone, E.164), `auth-errors.ts`
  (catégories d’erreur, messages français), `service.ts` (chaque appel à Supabase Auth),
  `store.ts` (état, mode démonstration), `social/google.ts`, `social/apple.ts`, `account.ts`.
- `src/features/auth/ui/` — connexion, inscription (+ `sign-up-verification.tsx`), `code-step.tsx`,
  `forgot-password-screen.tsx`, `account-screen.tsx`, `social-buttons.tsx`.
- `supabase/migrations/0007_auth_identity.sql` — le profil retient prénom, nom, numéro (vérifié ou
  non) et type de compte demandé ; le client ne peut modifier que son nom.
- `supabase/config.toml` (section `[auth]`) et `supabase/templates/` — réglages et e-mails en français.
- `scripts/check-auth-config.mjs` — `npm run auth:check`, contrôle du projet réel (lecture seule).

## Mise en service — dans cet ordre

### 1. Supabase

1. **Projet** : en créer un (région UE, Paris de préférence), noter sa référence.
2. **Base** : `npx supabase login`, `npx supabase link --project-ref <ref>`, puis
   `npx supabase db push` (migrations `0001` → `0007`) et
   `npx supabase functions deploy delete-account` (suppression de compte, exigée par les stores).
3. **Authentication → Providers → Email** : activé, **Confirm email** activé, longueur minimale 8.
4. **Authentication → Emails → Templates** : coller `supabase/templates/confirmation.html` dans
   « Confirm signup » et `recovery.html` dans « Reset password ». Ils contiennent `{{ .Token }}` :
   c’est le code que l’app demande. Sans lui, l’e-mail n’a qu’un lien et l’app attend en vain.
5. **SMTP** (Project Settings → Authentication → SMTP) : l’envoi par défaut de Supabase est limité à
   quelques e-mails par heure. Un vrai fournisseur (Brevo, Resend, Postmark…) est indispensable avant
   le pilote.
6. **Authentication → Providers → Phone** : activer, choisir **Twilio** (Account SID, Auth Token,
   Message Service SID), **Confirm phone** activé. Pour tester sans SMS : « Test phone numbers »,
   par ex. `33600000001=123456`. **Pas encore de fournisseur ?** Mettre `EXPO_PUBLIC_AUTH_PHONE=off` :
   l’app ne propose alors plus le téléphone (et le dit si on tape un numéro).
7. **Authentication → URL Configuration** : Site URL `https://tklink.fr`, Redirect URLs `tklink://`.
8. **Project Settings → API** : l’URL du projet et la clé **anon** (publique) vont dans les variables
   d’environnement (étape 4). **Jamais** la clé `service_role`.

### 2. Google Cloud Console

1. **Écran de consentement OAuth** : type Externe, nom « TK LINK », e-mail d’assistance, logo, domaine
   `tklink.fr`, champs d’application `openid`, `email`, `profile`. Le publier.
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
   « Skip nonce checks » désactivé (voir le dépannage si iOS se plaint du nonce).

### 3. Apple (compte développeur Progix)

1. **Certificates, Identifiers & Profiles → Identifiers** : pour `com.progix.tklink` (et
   `.preview`, `.dev` si on les teste), cocher **Sign In with Apple** (« Enable as a primary App
   ID »). EAS synchronise aussi la capacité au premier build iOS (le plugin
   `expo-apple-authentication` la déclare).
2. **Supabase → Providers → Apple** : activer ; **Client IDs** =
   `com.progix.tklink,com.progix.tklink.preview,com.progix.tklink.dev`. Le parcours natif n’a pas
   besoin de clé secrète Apple.
3. Build iOS avec le compte Apple de Progix : `npx eas-cli build -p ios --profile preview`.

Sur Android, le bouton Apple n’apparaît pas (Apple n’y a pas de fenêtre native) ; la règle 4.8 de
l’App Store ne concerne que l’iPhone, où Google et Apple sont toujours proposés ensemble.

### 4. Variables d’environnement

À créer dans EAS pour **preview** et **production** (expo.dev → projet → Environment variables, ou
`npx eas-cli env:create`), et dans le `.env` local :

| Variable                           | Valeur                                         |
| ---------------------------------- | ---------------------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`         | URL du projet Supabase                         |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY`    | clé **anon** (publique)                        |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | client OAuth « Application Web »               |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | client OAuth « iOS »                           |
| `EXPO_PUBLIC_AUTH_PHONE`           | `on` (défaut) ou `off` sans fournisseur de SMS |

⚠️ Dès que les deux variables Supabase existent, la build **quitte le mode démonstration** : les
comptes deviennent réels. Les écrans pré-remplis de démonstration (inscription, missions d’exemple)
restent tant que `EXPO_PUBLIC_APP_ENV` n’est pas `production`.

### 5. Vérifier

`npm run auth:check` lit le `.env` et dit, pour le vrai projet, ce qui est prêt et ce qui bloque
(fournisseurs, confirmation, SMS, migration 0007). Puis, sur téléphone, dérouler
[CUJ-007](../quality/critical-user-journeys.md).

## Dépannage

| Symptôme                                                        | Cause → correction                                                                          |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Google : `DEVELOPER_ERROR` (Android)                            | Package ou SHA-1 absent du client OAuth Android de la variante installée.                   |
| Google ou Apple : « Unacceptable audience in id_token »         | L’identifiant (client Web/iOS, ou bundle Apple) manque dans « Client IDs » de Supabase.     |
| Google sur iPhone : « nonce … should either both exist or not » | Activer « Skip nonce checks » pour Google dans Supabase.                                    |
| L’e-mail contient un lien, pas de code                          | Modèle sans `{{ .Token }}` : coller ceux de `supabase/templates/`.                          |
| Les e-mails n’arrivent pas, ou « rate limit »                   | SMTP par défaut de Supabase (limité) : brancher un fournisseur SMTP.                        |
| « L’envoi de SMS n’est pas disponible »                         | Fournisseur de SMS absent ou sans crédit (Twilio) ; ou passer `EXPO_PUBLIC_AUTH_PHONE=off`. |
| Le bouton Google n’apparaît pas                                 | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` vide dans la build.                                      |

## Sécurité — ce qui est tenu

- **Session** dans `LargeSecureStore` (AES + Keychain/Keystore) ; aucun mot de passe ni jeton n’est
  journalisé ou conservé ailleurs. Déconnexion : session de cet appareil seulement (`scope: local`).
- **Pas de navigateur intégré ni de redirection** : Google et Apple passent par leurs fenêtres natives
  et un jeton signé (SEC-AUTH-001/002). Apple : nonce aléatoire, empreinte SHA-256 donnée à Apple,
  nonce brut à Supabase.
- **Anti-énumération** : « Identifiant ou mot de passe incorrect » sans distinction ; « Si un compte
  existe… » au mot de passe oublié, y compris pour un numéro inconnu.
- **Profil** : `account_type`, `contact_phone`, `phone_verified` ne s’écrivent pas depuis le client
  (privilèges par colonne, testés en pgTAP). `account_type` est une **demande**, pas un droit.
- **Limites connues** (voir [quality-score](../quality/quality-score.md)) : la révocation du jeton
  Apple à la suppression du compte (exigence Apple) demande la clé `.p8` côté serveur — à faire avant
  la publication iOS ; un numéro de téléphone peut être réattribué par l’opérateur (une double
  authentification serait la parade) ; la protection contre les mots de passe divulgués est une
  option payante de Supabase.
