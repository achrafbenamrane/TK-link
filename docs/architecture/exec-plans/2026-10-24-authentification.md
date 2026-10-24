# Exec Plan — Authentification réelle (e-mail ou téléphone, Google, Apple)

- **Date:** 2026-10-24
- **Author:** agent + Achraf
- **Intent:** demande du client — « e-mail ou numéro avec mot de passe, Google, Apple », puis (même
  jour) compte obligatoire, Resend, numéro sans SMS en attendant Prelude, grossiste avec toutes les
  options, Apple aussi sur Android ([ADR-0010](../decisions/0010-compte-obligatoire-numero-sans-sms.md))
- **Status:** in-progress (code livré ; mise en service des consoles et test sur téléphone à faire)

## Goal & non-goals

Une authentification qui fonctionne de bout en bout dès qu’un projet Supabase est branché : inscription
par e-mail avec code, connexion par e-mail ou téléphone vérifié, mot de passe oublié, Google, Apple,
compte et suppression. Fait = `npm run verify` vert, `npm run auth:check` vert sur le projet réel,
[CUJ-007](../../quality/critical-user-journeys.md) déroulée sur Android et iPhone.
Hors périmètre : double authentification, synchronisation serveur des données locales (commandes,
fidélité…), révocation du jeton Apple (suivi ci-dessous).

## Already exists — reuse, do not recreate

- `src/features/auth/` (store, écrans, mode démonstration), `src/shared/lib/supabase.ts`
  (`LargeSecureStore`, PKCE), `src/shared/lib/env.ts`, `supabase/functions/delete-account`,
  `supabase/migrations/0002_profiles.sql`.

## Tasks

- [x] T1 — identifiant e-mail/téléphone + E.164 → `model/identifier.ts`
- [x] T2 — catégories d’erreur par code Supabase → `model/auth-errors.ts`
- [x] T3 — service Supabase typé (mot de passe, codes, téléphone, récupération, jeton d’identité) → `model/service.ts`
- [x] T4 — Google et Apple natifs (chargement paresseux, nonce Apple) → `model/social/`
- [x] T5 — store : nouvelles actions, mode démonstration conservé → `model/store.ts`
- [x] T6 — écrans : connexion, code, inscription + vérification, mot de passe oublié, compte → `ui/`
- [x] T7 — routes : `/forgot-password`, `/account` depuis le profil, session au démarrage → `src/app/`
- [x] T8 — base : profil rempli et verrouillé → `supabase/migrations/0007_auth_identity.sql` + pgTAP
- [x] T9 — config : `[auth]`, modèles d’e-mails, plugins Expo, `npm run auth:check`
- [ ] T10 — consoles : Supabase, Google Cloud, Apple Developer, variables EAS (guide : `docs/security/authentication.md`)
- [ ] T11 — build de test Android + iOS, CUJ-007 sur téléphone
- [ ] T12 — révocation du jeton Apple à la suppression du compte (clé `.p8`, fonction Edge)

### Second temps — demande du client du 24/10/2026 (ADR-0010)

- [x] T13 — compte obligatoire : porte d’entrée pure `decideEntry` (+ tests), `EntryGate` dans le layout,
      « Continuer sans compte » retiré, démo avec session conservée
- [x] T14 — numéro associé sans SMS : fonction Edge `link-phone`, migration `0008` (`phone_verified`
      jamais déduit d’Auth, compteur de tentatives, `phone_is_taken`, crochet `send_sms_disabled`) + pgTAP
- [x] T15 — mot de passe oublié par e-mail seulement ; e-mails par Resend (guide, `email_unavailable`)
- [x] T16 — Apple sur Android : page web + PKCE S256 (`digest` par expo-crypto), retour
      `tklink://auth/callback` sans navigation (`+native-intent`), `npm run apple:secret`
- [x] T17 — inscription pro avec Google/Apple (fiche obligatoire), type de compte déclaré une fois
      (`declare_account_type`), relu à la connexion (`syncProfile`)
- [x] T18 — `auth:check` : confirmations SMS, migration 0008, `link-phone` déployée
- [ ] T19 — consoles : domaine + Resend, crochet « Send SMS », Phone, Services ID + secret Apple,
      Redirect URL exacte (guide : `docs/security/authentication.md`)
- [ ] T20 — Prelude : vérification du numéro (`phone_verified`), SMS de mot de passe oublié

## Risks & landmines

- **Rien n’a pu être testé contre un vrai projet** : le connecteur Supabase n’était pas branché et il
  n’y a ni Docker ni CLI Supabase sur la machine. Le client est prouvé par tests (faux client
  Supabase), le SQL par l’analyseur PostgreSQL (syntaxe) — `supabase test db` reste à lancer.
- Nouveaux modules natifs : les builds existants ne les contiennent pas (nouveau build obligatoire).
- `String.replace` avec `$$` dans les scripts d’édition : utiliser une fonction de remplacement.
- Lignes de commande `node -e` avec des accents graves ou des `\\` : le shell les mange ; écrire un
  script dans un fichier.
- La CLI Supabase inverse `enable_confirmations` des SMS au `config push` : régler le projet hébergé
  dans le tableau de bord.

## Verification

- [x] `npm run verify` vert
- [ ] `npm run auth:check` vert sur le projet réel
- [ ] CUJ-007 sur téléphone (Android, iPhone)
- [x] Docs : `docs/security/authentication.md`, ADR-0009, backend, environnements, checklist, CUJ
