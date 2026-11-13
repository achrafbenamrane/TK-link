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
- **Un solde d’argent ne se tient pas par écritures « utilisation / restitution »** qu’un changement
  de statut pourrait désynchroniser : on le déduit de l’état des commandes (0019 : crédits
  débloqués − part de parrainage des commandes ni annulées, ni refusées, ni remboursées).
- **Une colonne remise à null par une clé étrangère (`on delete set null`) n’est exigée non nulle
  nulle part** — sinon la suppression de compte échoue (pgTAP test 73 le vérifie sur tout le
  schéma).

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

**Valider ou refuser un dossier** : dans `/admin` → Demandes (route serveur
`landing/app/admin/api/shops`, avec la clé de service côté Vercel : voir
[landing/DEPLOY.md](../../landing/DEPLOY.md)) — le refus exige un motif, que le professionnel lit dans
l’app. Sans le back-office relié, dans le SQL Editor du tableau de bord :

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

**`public.flash_orders` (0012) — la commande.** Plan :
[exec-plans/2026-11-13-rapport-avancement.md](exec-plans/2026-11-13-rapport-avancement.md).
Aucun droit d’écriture client : tout passe par des fonctions qui vérifient l’appelant.
`reserve_flash(items, fulfilment, address…)` verrouille les offres, vérifie qu’elles sont en ligne
et que le stock suffit, le décrémente, et calcule le prix et la commission (5 %,
`private.platform_config.commission_bps`). Une commande = un commerce (Stripe Connect en « Direct
charges »). Une réservation non payée expire en 15 minutes et rend son stock ; un compte en tient 3
au plus. Ensuite : `cancel_order` (acheteur, avant paiement), `advance_order` (commerçant :
payée → préparation → prête), `confirm_pickup(order, code)` (Touch & Collect : le commerçant scanne
le QR du client). Le code de retrait vit dans `private.order_pickup_codes` : seul l’acheteur le lit
(`order_pickup_code`), une fois payé. Le statut « payée » sera posé par le webhook Stripe (à
venir). `flash_orders` est publiée dans Supabase Realtime (sous RLS) pour le suivi en direct.

**Livraison : Uber Direct** (13/11/2026, à la place des livreurs TK LINK). Quatre fonctions Edge :
`uber-quote` (l’acheteur demande le prix de la livraison de sa commande réservée : il fixe
`delivery_fee_cents`), `uber-dispatch` (le commerçant commande la course quand c’est prêt ; une
seule course par commande), `uber-cancel` (le commerçant annule la course tant que le coursier n’a
pas pris le colis : la commande est d’abord prise en base, `uber_status = 'cancelling'`, puis Uber
est appelé ; refus → la course redevient ce qu’elle était ; accord → la course est effacée et la
commande reste « prête » pour rappeler un coursier) et `uber-webhook` (Uber fait avancer la
commande : en livraison, livrée, ou litige si la course échoue après paiement — mais un
« canceled » pendant `cancelling` est ignoré : une annulation voulue n’est pas un échec).

**Courses et paiements : deux règles contre les races** (relecture du 13/11/2026). (1) Avant
d’annuler chez Uber ou Stripe une chose dont le webhook fait avancer la commande, PRENDRE la
commande en base (écriture conditionnelle dont on vérifie qu’elle a touché une ligne), puis
appeler le fournisseur, et rendre la commande s’il refuse. (2) Une annulation côté serveur NOMME
la page de paiement qu’elle a expirée (`cancel_order_after_checkout(p_order, p_checkout)`,
`is not distinct from`) : une page ouverte entre-temps n’est jamais annulée dans son dos. Et
`stripe-payment` ne rouvre jamais une page pour une commande dont la page est « complete », et
referme celle qu’il vient d’ouvrir si la commande a changé (`order_locked`). Points ouverts : le
`Stripe-Version` n’est pas épinglé (les formes lues sont stables, mais à épingler au déploiement) ;
annuler une course déjà en route (`pickup`) peut coûter des frais selon le contrat Uber Direct. La logique pure (adresses, statuts, signature) est
dans `supabase/functions/_shared/uber.ts`, testée par `supabase/__tests__/uber.test.ts`.

Mise en route, une fois le compte Uber Direct ouvert (direct.uber.com → Developer) :

```sh
npx supabase secrets set UBER_CUSTOMER_ID=… UBER_CLIENT_ID=… UBER_CLIENT_SECRET=… \
  UBER_WEBHOOK_SIGNING_KEY=… UBER_FALLBACK_PHONE=+33…   # numéro TK LINK si un commerce n'en a pas
npx supabase functions deploy uber-quote
npx supabase functions deploy uber-dispatch
npx supabase functions deploy uber-webhook
npx supabase functions deploy uber-cancel
```

Puis, dans le tableau de bord Uber Direct → Webhooks : l’adresse
`https://<ref>.supabase.co/functions/v1/uber-webhook`, événement « delivery status ». Sans les
secrets, les deux fonctions de l’app répondent `503 uber_not_configured`.

## Support : messages et tickets (0014)

Décision du 13/11/2026 : clients et commerçants écrivent à **TK LINK** (pas entre eux). Une demande
(`support_tickets` : catégorie, sujet, commande éventuelle) porte des messages
(`support_messages`). Chacun ne lit que ses demandes ; un message venu de l’app ne peut pas se dire
« de TK LINK » (`from_staff` hors des droits client) ; le statut suit la conversation (réponse de
TK LINK → « en cours », nouveau message sur une demande résolue → « ouvert »), une demande
« fermée » ne reçoit plus rien ; 5 nouvelles demandes par compte et par 24 h. Les messages sont
publiés en temps réel (sous RLS). Le back-office répond depuis `/admin` → Messages, par la route
serveur `landing/app/admin/api/support/route.js` (clé de service côté Vercel : voir
[landing/DEPLOY.md](../../landing/DEPLOY.md), et changer d’abord le mot de passe du back-office).

## Fidélité par commerce (0017)

Mêmes règles que l’app (`src/features/loyalty`), tenues par le serveur pour les commerces du
serveur : programme par commerce (`loyalty_programs`, unité figée une fois enregistrée, 1 à 4
paliers croissants, `save_loyalty_program`), points crédités par un déclencheur quand une commande
passe « récupérée » ou « livrée » (`loyalty_ledger`, une fois par commande, 1 € d’articles ou 1 achat
= 1 point, rien sur la livraison), palier réclamé une fois contre un code (`claim_reward` →
`loyalty_rewards`, `TK-XXXXXX`), validé par le seul titulaire du commerce (`redeem_reward`). Aucune
écriture directe. Côté app : `loyalty/lib/loyalty-api.ts` ; le store local sert de copie pour les
commerces du serveur (UUID) et garde la fidélité locale des enseignes de démonstration.

**Partage d’une récompense (0018).** Le commerçant valide un CODE, pas une personne : partager,
c’est envoyer le code. `share_reward` (titulaire seul, une fois) passe la récompense « partagée » —
elle quitte l’inventaire de qui l’offre, reste dans son historique — et `redeem_reward` accepte une
récompense disponible OU partagée. Les points, eux, ne se transfèrent jamais (CDC V1.1).

## Parrainage (0019)

CDC V1.1 : 5 € au parrain ET au filleul, financés par TK LINK, débloqués au premier achat réel du
filleul. Chaque compte a son code (`my_referral_code`, `TK-XXXXXX`) ; un nouveau client (aucune
commande payée) saisit celui d’un parrain, une fois (`apply_referral_code`). Sa première commande
« récupérée » ou « livrée » crédite les deux comptes (déclencheur, `referral_credit_cents` = 500).
Les crédits débloqués (`referral_credits` : parrain, filleul) sont écrits par le serveur seul ; le
solde s’en déduit, moins la part de parrainage (`flash_orders.referral_credit_cents`) des commandes
ni annulées, ni refusées, ni remboursées. **Il se déduit à la réservation (`reserve_flash`), borné à la commission de TK
LINK** : en Stripe « Direct charges », le prélèvement de TK LINK ne peut pas être négatif, donc TK
LINK n’offre que ce qu’il aurait prélevé (≈ 0,35 € sur 7 €) et le crédit sert sur plusieurs
commandes. Une réservation annulée (ou expirée) et une commande remboursée rendent donc le crédit d’elles-mêmes ;
une réservation annulée puis payée quand même (litige) le reprend. Un remboursement ne retire pas
le crédit débloqué par la première commande (à confirmer avec le client). Passer en « charges
séparées et virements » permettrait de tout déduire d’un coup : seule la borne de `reserve_flash`
changerait. Côté app : `referral/lib/referral-api.ts`, `shop/lib/discount.ts` (même borne dans le
panier) ; sans la migration, l’app garde le parrainage local.

## Notifications (0016)

L’app enregistre le jeton Expo du téléphone (`register_push_token`, retiré à la déconnexion par
`unregister_push_token`) ; la table `push_tokens` n’est lisible par personne. La fonction
`push-events` envoie : « payée » → le commerçant (nouvelle commande) ; préparation, prête,
en livraison, livrée, litige, remboursée → l’acheteur ; réponse de TK LINK → l’auteur de la
demande. Les destinataires sont lus en base, jamais dans la requête ; les jetons d’applications
désinstallées sont effacés. Logique pure : `supabase/functions/_shared/push.ts`
(`supabase/__tests__/push.test.ts`).

Mise en route : `npx supabase secrets set PUSH_WEBHOOK_SECRET=<aléatoire long>`,
`npx supabase functions deploy push-events`, puis tableau de bord → Database → Webhooks : deux
webhooks (POST vers `https://<ref>.supabase.co/functions/v1/push-events`, en-tête
`x-webhook-secret`) — `flash_orders` (INSERT, UPDATE) et `support_messages` (INSERT). Côté app, les
notifications demandent une nouvelle APK (module natif `expo-notifications`) et les identifiants
FCM dans EAS pour Android.

## Visuels IA des commerces : fal.ai (0015)

Un commerçant validé fait générer une image ou une vidéo de présentation de sa boutique.
`ai-media-start` vérifie le quota du jour (10 images, 2 vidéos, `private.platform_config`),
construit le texte envoyé au modèle (nom, catégorie, description nettoyée : jamais reçu tel quel),
crée la ligne `shop_media` et soumet à la file fal.ai. L’app relève avec `ai-media-status` : une
fois prêt, le fichier est copié dans Storage (`shop-media`, public) car les adresses fal.ai
expirent. Le public voit les visuels prêts et montrés d’un commerce validé ; le commerçant les
cache ou les montre (`set_shop_media_visible`). Logique pure : `supabase/functions/_shared/fal.ts`,
testée par `supabase/__tests__/fal.test.ts`.

```sh
npx supabase secrets set FAL_KEY=…        # facultatifs : FAL_IMAGE_MODEL, FAL_VIDEO_MODEL
npx supabase functions deploy ai-media-start
npx supabase functions deploy ai-media-status
```

## Paiement des commandes : Stripe Connect (0013)

CDC V1.1 : « Direct charges ». Le client paie le commerçant (son compte Stripe connecté) ; TK LINK
prélève commission + livraison − réduction qu’il offre, si bien que le commerçant touche toujours
`sous-total − commission`. Quatre fonctions Edge, la logique pure dans
`supabase/functions/_shared/stripe.ts` (testée par `supabase/__tests__/stripe.test.ts`) :

- `stripe-connect` (commerçant validé) : crée son compte Express au premier appel
  (`shops.stripe_account_id`) et rend la page d’inscription Stripe (identité, IBAN — TK LINK n’en
  voit rien).
- `stripe-payment` (acheteur) : ouvre une page **Stripe Checkout** pour sa commande réservée, sur le
  compte du commerçant (carte, Apple Pay, Google Pay). Les lignes et les frais viennent de la
  commande ; la page ne facture jamais autre chose que le total du serveur ; une livraison exige
  d’abord le devis Uber. Checkout plutôt que la feuille native : aucun module natif, le paiement
  part par mise à jour OTA (13/11/2026). Retour par `/stripe/paiement` sur le site, qui rouvre
  l’app.
- `stripe-webhook` : paiement réussi → « payée » (vaut acceptation) ; payé après expiration de la
  réservation → « litige » ; remboursement total → « remboursée » ; `account.updated` →
  `shops.stripe_charges_enabled`.
- `stripe-balance` (commerçant) : l’onglet Versements lu chez Stripe — le solde du compte connecté
  (disponible, en attente) et ses dix derniers virements. Lecture seule ; avant les clés ou
  l’inscription, l’app garde son estimation.

Mise en route (mode test possible avant l’immatriculation de la société) :

```sh
npx supabase secrets set STRIPE_SECRET_KEY=sk_test_… STRIPE_WEBHOOK_SECRET=whsec_… \
  STRIPE_CONNECT_RETURN_URL=https://…/stripe/retour STRIPE_CONNECT_REFRESH_URL=https://…/stripe/relancer   STRIPE_PAYMENT_RETURN_URL=https://…/stripe/paiement
npx supabase functions deploy stripe-connect
npx supabase functions deploy stripe-payment
npx supabase functions deploy stripe-webhook
npx supabase functions deploy stripe-balance
npx supabase functions deploy order-cancel
```

**Annuler avec une page de paiement ouverte (0020).** `cancel_order` refuse (`checkout_open`) dès
qu’une page Checkout a été ouverte : sinon le stock revenait, puis le paiement arrivait quand même.
L’app appelle alors `order-cancel`, qui fait d’abord expirer la page chez Stripe (plus personne ne
peut y payer ; si le paiement vient d’aboutir, Stripe refuse et la commande reste payée), puis annule
par `cancel_order_after_checkout` (réservée au serveur).

Dans Stripe → Développeurs → Webhooks : un point de terminaison **Connect** vers
`https://<ref>.supabase.co/functions/v1/stripe-webhook`, événements `payment_intent.succeeded`,
`charge.refunded`, `account.updated`. L’app n’a besoin d’aucune clé Stripe (la page Checkout est
créée par le serveur).

```sql
-- Les paiements à régler à la main (payés hors délai, course Uber échouée…)
select id, status, total_cents, stripe_payment_intent_id, uber_status, updated_at
  from public.flash_orders where status = 'litige' order by updated_at desc;
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
