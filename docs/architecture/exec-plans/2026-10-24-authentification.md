# Exec Plan — Authentification réelle (e-mail ou téléphone, Google, Apple)

- **Date:** 2026-10-24
- **Author:** agent + Achraf
- **Intent:** demande du client — « e-mail ou numéro avec mot de passe, Google, Apple »
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

## Risks & landmines

- **Rien n’a pu être testé contre un vrai projet** : le connecteur Supabase n’était pas branché et il
  n’y a ni Docker ni CLI Supabase sur la machine. Le client est prouvé par tests (faux client
  Supabase), le SQL par l’analyseur PostgreSQL (syntaxe) — `supabase test db` reste à lancer.
- Nouveaux modules natifs : les builds existants ne les contiennent pas (nouveau build obligatoire).
- `String.replace` avec `$$` dans les scripts d’édition : utiliser une fonction de remplacement.

## Verification

- [x] `npm run verify` vert
- [ ] `npm run auth:check` vert sur le projet réel
- [ ] CUJ-007 sur téléphone (Android, iPhone)
- [x] Docs : `docs/security/authentication.md`, ADR-0009, backend, environnements, checklist, CUJ
