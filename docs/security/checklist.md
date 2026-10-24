---
id: security-checklist
read-when: Running a security review, adding auth/storage/network/payments code, or before a release. The `/security-review` skill (Phase 6) cites these rule IDs.
owns: The enforceable security rule catalog (queryable) for this skeleton, with severity, how-to-verify, and enforcement.
---

# Security checklist (rule catalog)

Queryable rule file. Severity: **P1** block-release · **P2** fix-before-merge · **P3**
improve. "Enforced" = the automated mechanism; "manual" rules are checked in review /
by `/security-review`. Rationale + sources: [`../research/01-mobile-security.md`](../research/01-mobile-security.md).

`id | severity | rule | how to verify | enforced by`

```
SEC-STORE-001 | P1 | Secrets (tokens, keys, PII) never go to AsyncStorage/appStorage; use secureStorage/LargeSecureStore | grep for sensitive data routed to appStorage; review storage calls | ESLint no-restricted-imports + review
SEC-STORE-002 | P1 | Underlying storage libs imported only inside src/shared/lib/storage | npm run lint | ESLint no-restricted-imports
SEC-STORE-003 | P2 | Large secret blobs (>2KB, e.g. Supabase session) use LargeSecureStore, not raw SecureStore | review session/token storage wiring | review
SEC-STORE-004 | P2 | Secrets use deviceOnly + are deleted on logout; excluded from Android backup | review logout + app.config backup rules | review (Phase 2)
SEC-SECRET-001 | P1 | No hardcoded secrets (service_role JWT, sk_live/test, sb_secret_) in source or bundle | npm run secrets:check; npm run secrets:scan | check-secrets + gitleaks
SEC-SECRET-002 | P1 | No EXPO_PUBLIC_* var whose name implies a secret (SECRET/TOKEN/SERVICE_ROLE/PASSWORD/PRIVATE) | npm run secrets:check | check-secrets
SEC-SECRET-003 | P1 | service_role / secret keys live only server-side (EAS secret / Edge Function), never in the app | review env + client code | review + check-secrets
SEC-SECRET-004 | P2 | Third-party secret API keys are proxied via a BFF (Edge Function), not called from the client | review network calls | review
SEC-LOG-001 | P2 | No tokens/PII in logs or Sentry; use logger (redacts) not console for auth/network data | grep console.* near auth/network; review Sentry beforeSend | logger + review
SEC-LINK-001 | P1 | Deep-link paths resolved through the allowlist gate; unknown → safe fallback | deep-link.test.ts; review +native-intent.tsx | tests + review
SEC-LINK-002 | P1 | Deep-link params never used for authorization (RLS/server enforces ownership) | review param usage | review
SEC-LINK-003 | P2 | External URLs opened only if https + allowlisted host (isAllowedExternalUrl) | grep openURL/WebBrowser/openAuthSession | review
SEC-INPUT-001 | P1 | Every trust-boundary input (user, rehydration, network, link) passes a Zod schema | review schema.ts coverage | review (AGENTS hard rule)
SEC-NET-001 | P2 | Production blocks cleartext (ATS on iOS, usesCleartextTraffic off Android) | inspect app.config / config plugin | review (Phase 1 backlog)
SEC-AUTH-001 | P1 | OAuth uses the system browser + PKCE; never an embedded WebView | review auth flow | review (Phase 2)
SEC-AUTH-002 | P1 | Auth callback rides a verified Universal/App Link, not a bare custom scheme | review redirect URI config | review (Phase 2) — exception ADR-0010 : Apple sur Android revient sur tklink://auth/callback, protégé par PKCE S256 (entrée exacte dans les Redirect URLs, jamais journalisé, aucune navigation) ; le reste sans retour (jetons natifs, codes à 6 chiffres)
SEC-AUTH-003 | P1 | No account enumeration: same message for unknown identifier and wrong password; password reset never confirms an account exists | auth-errors + forgot-password tests | jest — exception bornée (ADR-0010) : associer un numéro déjà pris le dit, cinq numéros différents par compte et par 24 h (pgTAP + link-phone) ; sans compte, signUp({ phone }) reste distinguable (limites d’Auth par IP) jusqu’à Prelude ou un CAPTCHA
SEC-AUTH-004 | P1 | Sign in with Apple uses a random nonce (SHA-256 to Apple, raw to Supabase); ID tokens never logged | social.test.ts; review | jest + review
SEC-AUTH-005 | P1 | Client cannot write server-owned profile columns (account_type, account_type_declared, contact_phone, phone_verified); the account type is declared once | pgTAP rls.test.sql | supabase test db
SEC-AUTH-006 | P1 | No client path creates or confirms a phone number: the Send SMS hook refuses every SMS, phone confirmations stay ON, only link-phone (service role, e-mail confirmed — "Confirm email" must stay ON, one number, duplicates checked) sets it | pgTAP rls.test.sql; npm run auth:check (blocks on phone or e-mail autoconfirm) | supabase test db + auth:check
SEC-RLS-001 | P1 | RLS enabled + deny-by-default on every table; client never trusted for authz | supabase db lint (lints 0007/0013/0015); pgTAP | gate (Phase 2)
SEC-SUPPLY-001 | P2 | Lockfile committed; deps added via npx expo install; npm audit clean of highs | npm audit; review package.json diff | review
SEC-RESIL-001 | P3 | High-value actions verified by server-side attestation (Play Integrity / App Attest) | review sensitive action flow | review (dev build, backlog)
SEC-PRIV-001 | P2 | Sensitive screens enable screen-capture protection (expo-screen-capture) | review PII/payment screens | review (backlog)
```

## How `/security-review` uses this

The Phase 6 `/security-review` skill diffs the branch, evaluates each touched area against
the rules above, and reports findings as `[P1|P2|P3] SEC-… — file:line — issue — fix`, then
a verdict (any P1 ⇒ REQUEST-CHANGES). Until that skill exists, run the checklist by hand on
anything touching storage, secrets, auth, deep links, network, or payments.
