---
id: architecture-backend
read-when: Touching auth, the Supabase client, database tables/migrations, RLS policies, Edge Functions, or payments.
owns: How the Supabase backend is wired and the secure-by-default rules for using it.
---

# Backend (Supabase)

The backend is Supabase, configured **RLS-first** (ADR-0007). The golden rule:
**the mobile client is untrusted and ships a public key — Postgres Row-Level
Security is the authorization boundary, not the client.** Evidence + deeper detail:
[`docs/research/03-supabase-security.md`](../research/03-supabase-security.md).

## Client

`src/shared/lib/supabase.ts` exports the configured `supabase` client. Security-critical
config (do not change without reading the comments there): session in
`LargeSecureStore` (AES + Keychain), `flowType: 'pkce'`, `detectSessionInUrl: false`,
`autoRefreshToken`, `lock: processLock`. `registerSupabaseAutoRefresh()` is called once
in `src/app/_layout.tsx`. Only the **anon/publishable** key is bundled; `env.ts` rejects
a service_role key.

## Auth

`src/features/auth` owns sign in / up / out, the session store (`useAuthStore`), e-mail **or**
phone + password, Google and Apple (native ID-token flows), six-digit codes for confirmation and
password recovery, and the account screen (sign-out, phone linking, deletion). **An account is
mandatory** (ADR-0010): the root layout loads the session at startup and its `EntryGate` applies
`decideEntry` — without a session only the splash, role choice, sign-up, sign-in and forgot-password
screens open. A phone number is linked without SMS by the `link-phone` Edge Function (Prelude will
verify it later); Apple on Android goes through Apple’s web page with PKCE. Inputs are Zod-validated
before any network call. Migrations `0007_auth_identity` and `0008_phone_link_account_type` fill
`public.profiles` at sign-up, lock the server-owned columns and let a Google/Apple sign-up declare
its account type once. Full guide and console setup: [authentication](../security/authentication.md)
([ADR-0009](decisions/0009-authentification.md), [ADR-0010](decisions/0010-compte-obligatoire-numero-sans-sms.md)).

## Database — secure-by-default rules

Migrations live in `supabase/migrations/` and run in order. **Deny-by-default** is
enforced by `0001_security_baseline`:

- Blanket grants to `anon`/`authenticated` are revoked — a new table exposes nothing
  until you explicitly `grant` + add a policy.
- An **event trigger auto-enables RLS** on every new public table (so a raw-SQL table
  can't ship without RLS).
- A `private` schema holds `security definer` helpers (never API-exposed), with
  `search_path = ''` pinned.

### Adding a per-user table (copy `0003_notes`)

```sql
create table public.things (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- ... columns ...
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.things to authenticated;
create index things_user_id_idx on public.things (user_id);

create policy "things: select own" on public.things for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "things: insert own" on public.things for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "things: update own" on public.things for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "things: delete own" on public.things for delete to authenticated
  using ((select auth.uid()) = user_id);
```

Rules: one policy **per command** (never `FOR ALL`); always `to authenticated`; wrap
`auth.uid()` in `(select …)`; `WITH CHECK` on writes; index the policy column; never
read `user_metadata` in a policy (user-editable); split highly-sensitive columns into
their own table. Enforce MFA on a table with a restrictive policy:
`as restrictive ... using ((select auth.jwt()->>'aal') = 'aal2')`.

## Le marché (branchement en cours)

Plan : [exec-plans/2026-11-11-marche-sur-supabase.md](exec-plans/2026-11-11-marche-sur-supabase.md).
Les tables `merchants`/`deals`/`orders` de `0005` datent d’avant le CDC V1.1 et ne sont pas
utilisées par l’app : ne pas s’en servir, elles seront retirées.

**`public.shops` (0010) — le dossier du professionnel.** Un par compte, un compte par SIRET (clé de
Luhn vérifiée par le serveur), du type de compte **déclaré**. Le statut (`en_verification`,
`valide`, `refuse`) n’est dans aucun droit client ; un déclencheur force `en_verification` au dépôt
et y renvoie un dossier refusé que l’on corrige, ou validé dont on change le SIRET ou le nom. Le
public ne lit que les commerces validés. Côté app : `src/features/merchant/lib/shop-api.ts`.

**Valider ou refuser un dossier** (TK LINK, SQL Editor du tableau de bord, en attendant une vraie
connexion à `/admin`) :

```sql
-- Les dossiers à contrôler
select name, kind, siret, address, submitted_at from public.shops
 where status = 'en_verification' order by submitted_at;

-- Valider
update public.shops set status = 'valide' where siret = '44306184100047';

-- Refuser, avec le motif que le professionnel verra dans l'app
update public.shops set status = 'refuse',
       review_note = 'Le SIRET ne correspond pas à l’adresse indiquée.'
 where siret = '44306184100047';
```

L’app relit le statut à l’ouverture de l’onglet Flash et de l’écran du dossier.

**`public.flash_offers` (0011) — les Flash en direct.** Publiées par un commerce **validé**, pour
lui seul. Le client déclare (titre, prix en centimes, quantité, durée, heure souhaitée) ; le serveur
calcule le stock restant (`stock_left`, hors de tout droit client, ne baissera que par une commande),
l’heure de fin, et tient le quota d’opérations (`shops.ops_free` = 5 par défaut + `ops_purchased`,
posés par TK LINK). Un Flash dure 15 min à 2 h ; une offre pro n’a pas de borne. Le public lit les
Flash clients en ligne d’un commerce validé ; les offres pro ne se lisent qu’entre professionnels.
Retirer une offre est le seul geste d’écriture du titulaire, sans retour en ligne. Photos : dossier
Storage public `flash-photos`, écriture dans `<id du compte>/…` seulement. Côté app :
`merchant/lib/flash-api.ts` (publier, relire, retirer), `shop/lib/feed-api.ts` + `shop/model/live.ts`
(le flux client, retrouvé par `getDeal`/`getMerchant`).

```sql
-- Offrir des opérations à un commerce (geste commercial, ou pack payé hors app)
update public.shops set ops_purchased = ops_purchased + 10 where siret = '44306184100047';
```

## Payments (entitlement is server-owned)

`public.subscriptions` is **client read-only** (no client write policy). The
`supabase/functions/revenuecat-webhook` Edge Function authenticates RevenueCat by a
shared-secret `Authorization` header (RevenueCat doesn't sign bodies), runs with
`verify_jwt = false`, and writes entitlement with the service_role key. Configure
RevenueCat `appUserID` = the Supabase user id. Gate premium features by joining
`subscriptions` in the feature's RLS policy. See
[`docs/research/06-payments-analytics-stack.md`](../research/06-payments-analytics-stack.md).

## Verification (release gates)

- `supabase test db` runs the pgTAP RLS tests in `supabase/tests/database/`.
- `supabase db lint` (Security Advisor) must be clean of ERROR lints — **0007**
  (policy exists, RLS disabled), **0013** (RLS disabled in public), **0015** (RLS
  references user_metadata). Treat these as release blockers.

## Setup (on your machine)

```
npx expo install   # reconcile native deps (incl. @supabase/supabase-js, url polyfill)
supabase init      # if you don't have a full config.toml yet
supabase start     # local stack
supabase db reset  # apply migrations
supabase test db   # run RLS tests
```

Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env`
(never the service_role key). Edge Function secrets via `supabase secrets set`.
